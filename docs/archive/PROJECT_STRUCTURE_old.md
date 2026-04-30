# PROJECT_STRUCTURE.md
**WebRTC SIP Softphone — Technical Architecture Reference**
_Authoritative source. Derived from actual codebase. Last updated: 2026-03-28._

---

## 1. Project Purpose

A production WebRTC SIP softphone deployed as a Progressive Web App (PWA). Users dial and receive SIP calls from a browser on desktop, Android, and iOS. The system bridges WebRTC media to a SIP/PBX infrastructure using Kamailio, RTPEngine, and CoTURN.

**Key capabilities:**
- SIP registration & authentication against a FusionPBX/Kamailio backend
- Outgoing and incoming calls via SIP.js 0.21.x over WSS
- Hold/unhold with SIP re-INVITE and RTP media recovery
- Dual-call management (add call, swap, conference via REFER/Replaces)
- Push notifications for incoming calls when the app is backgrounded (iOS/Android)
- Multi-domain PBX support (load-balanced)
- Remote device logging and admin dashboard

---

## 2. Major Directories

```
/opt/webrtc-sbc/
├── www/                  Frontend PWA (SPA)
│   ├── index.html        Thin app shell; injects APP_CONFIG from template vars
│   ├── sw.js             Service Worker — push notification handling
│   ├── config.js         Reads data-* attributes from <body> → window.APP_CONFIG
│   ├── app.js            Express.js bootstrap (serves the SPA)
│   ├── app/              All application JS modules (see §4)
│   ├── styles/           Modular CSS (theme, forms, dialpad, history)
│   └── vendor/sip.min.js SIP.js 0.21.x

├── push-server/          Node.js push notification + device-log backend
│   ├── server.js         Express bootstrap (~87 lines)
│   └── src/              Modular route/service/middleware layout (see §7)

├── kamailio/             SIP proxy configuration
│   ├── kamailio.cfg      Main config entry point
│   ├── local.cfg         Generated from local.cfg.template via make
│   └── routes/           Modular route files (10-incoming, 11-outgoing, etc.)

├── rtpengine/            RTP media engine (WebRTC ↔ SIP media bridging)
├── coturn/               STUN/TURN server
├── nginx/                Reverse proxy / WSS termination
├── certs/                TLS certificates
├── scripts/              Setup utilities

├── docker-compose.yml    Multi-container orchestration
├── Makefile              envsubst template generation + container lifecycle
├── .env                  Runtime secrets and deployment config (NOT committed)
└── .env.example          Template for all required env vars
```

---

## 3. Configuration System

### Build-time → Runtime injection

The project uses a **template + envsubst** pipeline. `make` renders templates using `.env`:

| Template | Output |
|---|---|
| `www/index.html.template` | `www/index.html` |
| `kamailio/local.cfg.template` | `kamailio/local.cfg` |
| `coturn/turnserver.conf.template` | `coturn/turnserver.conf` |
| `rtpengine/rtpengine.conf.template` | `rtpengine/rtpengine.conf` |
| `nginx/phone.srve.cc.conf.template` | `nginx/phone.srve.cc.conf` |

**Important:** Never manually edit the generated output files. Edit the `.template` versions.

### Key .env variables

```env
DOMAIN=phone.srve.cc          # Frontend domain (Nginx, WSS)
PUBLIC_IP=38.242.157.239      # Server public IP
PBX_IP=testfusn.srve.cc       # Primary PBX/FusionPBX host
PBX_PORT=5060
TURN_HOST=phone.srve.cc
TURN_USER=turnuser
TURN_PASS=turnpass
RTP_MIN=30000  RTP_MAX=31000
VAPID_PUBLIC_KEY=...           # Web Push signing key
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@srve.cc
CONFERENCE_FEATURE_ENABLED=false
PBX_MAP_1_DOMAIN / PBX_MAP_1_HOST  # Multi-domain PBX entries
```

### Frontend runtime config (www/config.js)

`www/config.js` reads `data-*` attributes from `<body>` (injected by the `index.html` template) and populates `window.APP_CONFIG`. The frontend module `www/app/config.js` consumes this to build ICE server lists, TURN credentials, etc.

**Known issue:** TURN credentials in `www/app/config.js` still have fallback hardcoded values (`turnuser`, `turnpass`, `phone.srve.cc`). See `docs/archive/PROJECT_AUDIT_TRACKER.md` for full hardcoding audit.

---

## 4. Frontend Application Architecture

### Entry point and platform detection

```
www/index.html
  └── www/app/page/bootstrapPage.js   (renders layout, then imports main.js)
        └── www/app/main.js            (detects platform, routes to bootstrap)
              ├── Android → www/app/runtime/android/bootstrapAndroid.js
              ├── iOS     → www/app/runtime/ios/bootstrapIos.js
              └── Desktop → www/app/runtime/desktop/bootstrapDesktop.js
```

Platform detection is `navigator.userAgent`-based in `main.js`.

### App state object

**File:** `www/app/registration/state.js` — `createAppState()`

```js
{
  ua: null,               // SIP.js UserAgent instance
  sbcUa: null,            // Secondary SBC UA (currently disabled)
  reg: null,              // Active REGISTER handler
  registered: false,
  registering: false,
  session: null,          // Active call (Inviter or Invitation)
  incomingInvitation: null,
  account: null,          // { username, domain, rawUsername }
}
```

Every platform bootstrap creates its own `st` object via `createAppState()` and threads it through all feature modules.

### Module map

| Directory | Purpose |
|---|---|
| `app/registration/` | SIP UA creation, REGISTER flow, transport listener |
| `app/incoming/` | Incoming INVITE gating, answer, reject |
| `app/outgoing/` | Outgoing INVITE, hangup, add-call |
| `app/features/` | Hold/unhold (`sipHold.js`), dual session (`dualSessionManager.js`) |
| `app/conference/` | Conference PIN lookup, guest registration |
| `app/push/` | Push support detection, SW subscription, VAPID |
| `app/runtime/` | Platform-specific bootstraps + shared control bindings |
| `app/ui/` | Call controls, call timer, history, DTMF, audio route |
| `app/layout/` | Declarative HTML section renderers |
| `app/page/` | Page init, dialpad input, cache actions, debug toggle |
| `app/pc/` | PeerConnection stats and debugging |
| `app/util/` | DTMF sender wrapper |
| `app/remoteLogs/` | Device fingerprinting, log transport, service lifecycle |
| `app/config.js` | ICE servers, codec flags, TURN credentials |
| `app/sdp.js` | `g711OnlyModifier()` — strips non-G.711 codecs from SDP |
| `app/log.js` | In-app log panel + SIP rejection code → human message mapping |
| `app/media.js` | Microphone access (`ensureMicAccess`) + local stream management |
| `app/dom.js` | DOM selector cache + shared UI utilities |

---

## 5. SIP Registration Flow

**File:** `www/app/registration/primary.js`

1. User submits credentials (extension, domain, password)
2. `startPrimaryRegistration(SIP, st, ui)`:
   - Calls `buildUserAgent()` → creates `SIP.UserAgent` with:
     - `authorizationUsername`, `authorizationPassword`
     - WSS transport (`wss://{DOMAIN}/ws`)
     - `sipExtension100rel: "Supported"`
     - ICE servers from `app/config.js`
     - 15s keepalive, 3s debounce, 999 reconnect attempts
     - `onInvite` delegate → routes to `handleIncomingCallIsolated()`
   - Creates REGISTER handler → calls `register()`
   - Attaches transport listener (auto-re-registers on reconnect)
   - Starts 150-second periodic re-registration (for Android background keep-alive)
3. On successful registration: `setRegistrationComplete()` marks timestamp (used by incoming call phantom-call guard)

**Secondary registration (`registration/secondary.js`):** SBC fallback — currently disabled in production.

---

## 6. Outgoing Call Flow

**File:** `www/app/outgoing/call.js` — `startCall(SIP, st, ui)`

```
Validate (registered, target URI, no active call)
  → ensureMicAccess()
  → Build sip:{encoded_target}@{domain}
  → Create SIP.Inviter with:
      earlyMedia: true
      P-Early-Media: supported
      g711OnlyModifier (strips non-G.711 codecs)
      localMediaStream from mic
  → Setup requestDelegate:
      onTrying  → log
      onProgress:
        180 Ringing  → start ringback tone
        183 + SDP    → stop ringback, attach early media audio
      onAccept   → log call history
      onReject   → map SIP code to user message, log history
  → inviter.stateChange listener:
      Established → dualSessionManager.setPrimary(st), start timer, bind PC debug
      Terminated  → cleanup, dualSessionManager.removeSession(st)
  → inviter.invite({ requestDelegate })
```

**Hangup:** `hangupCall(st, ui)` — `session.bye()` (Established) or `session.cancel()` (pre-answer).

---

## 7. Incoming Call Flow

**File:** `www/app/incoming/handlers.js` — `handleIncomingCallIsolated(SIP, st, ui, invitation)`

### Phantom-call gates (critical — do not remove)

```
GATE 1: NOT registered?              → Reject 480, return
GATE 2: < 3s since setRegistrationComplete()?  → Reject 480 (iPhone post-login phantom)
GATE 3: < 5s since page load?        → Reject 480 (startup phantom protection)
GATE 4: Already in active session?   → Reject 486 Busy
```

These gates exist because iOS generates phantom INVITEs after registration completes. Removing them causes ringing during/immediately after login.

### Answer path

`answerIncomingCallIsolated(SIP, st, ui)`:
1. `ensureMicAccess()`
2. `invitation.accept({ sessionDescriptionHandlerOptions: { constraints, modifiers: [g711OnlyModifier] } })`
3. `dualSessionManager.setPrimary(st)`
4. Start call timer

### Reject path

`rejectIncomingCallIsolated(st, ui)` → `invitation.reject({ statusCode: 486 })`

---

## 8. Hold / Unhold

**File:** `www/app/features/sipHold.js` — `setSIPHold(st, shouldHold)`

1. Validates session is Established; debounces concurrent requests
2. Gets PeerConnection from `st.session.sessionDescriptionHandler.peerConnection`
3. Sends SIP re-INVITE with SDP direction modifier:
   - **Hold:** `sendonly` (via SIP.js built-in `holdModifier` or `forceAudioDirectionModifier`)
   - **Unhold:** ensures track enabled, re-attaches local sender track, sets `recvonly` or `sendrecv`
4. Waits 150ms for session to settle; verifies still Established
5. **Post-unhold RTP recovery:** snapshots RTP packet counts, waits 2.5s, checks delta. If stalled (0 packets), re-sends re-INVITE with `iceRestart: true`
6. Re-attaches `remoteAudio` element from PeerConnection receiver track (unmute, volume=1)

**Do not break:** The post-unhold RTP recovery step is essential. Without it, Kamailio/RTPEngine sometimes doesn't resume media after unhold and the call goes silent.

---

## 9. Dual Call / Multi-Session / Conference

**File:** `www/app/features/dualSessionManager.js`

Singleton exported as `window.dualSessionManager`.

### State

```js
{
  primary: st | null,
  secondary: st | null,
  primaryOnHold: boolean,
  secondaryOnHold: boolean,
}
```

### Key methods

| Method | Description |
|---|---|
| `canAddCall()` | true if primary exists and no secondary yet |
| `hasDualSessions()` | true if both primary and secondary active |
| `getActiveSession()` | returns `{st, type}` of the non-held session |
| `getHeldSession()` | returns `{st, type}` of the held session |
| `setPrimary(st)` | store first call |
| `setSecondary(st)` | store second call |
| `removeSession(st)` | remove and optionally promote secondary to primary |
| `swap()` | toggle hold on both sessions, emit `dual-session:hold-changed` |
| `conference()` | attended transfer via REFER + Replaces header (RFC 3891) |
| `reset()` | clear all state |

### Add call sequence

**File:** `www/app/outgoing/addCall.js` — `addSecondCall(SIP, primarySt, ui, number)`

1. `canAddCall()` check
2. Hold primary: `setSIPHold(primarySt, true)`
3. Create secondary `st` object (shares `ua` with primary)
4. Create `SIP.Inviter` for new number
5. On establishment: `dualSessionManager.setSecondary(secondarySt)`
6. On failure: unhold primary, restore UI

### Conference (attended transfer)

`dualSessionManager.conference()`:
1. Gets held session and active session
2. Extracts dialog info from active session: `callId`, `localTag`, `remoteTag`
3. Builds `Replaces` header: `callId;to-tag=X;from-tag=Y`
4. Sends `REFER` from held session's `session.refer()` targeting active session's remote party with `Replaces`
5. PBX (Kamailio/FusionPBX) bridges the two calls at the server

**UI control:** Swap and Conference buttons are shown/hidden via `dual-session:state-changed` CustomEvent from `dualSessionManager.emitStateChange()`.

---

## 10. Push Notification System

### Components

```
www/app/push/          Frontend push subscription management
www/sw.js              Service Worker: receives push events, wakes clients
www/app/runtime/*/     Platform-specific push init
push-server/           Backend: stores subscriptions, sends via web-push
```

### Frontend flow

1. **Support detection:** `push/support.js` — checks `serviceWorker`, `PushManager`, `Notification`. iOS requires standalone (home screen) mode.
2. **SW registration:** `registerServiceWorker()` → registers `/sw.js?v={BUILD}` and waits for `ready`.
3. **Permission:** `requestNotificationPermission()` — shows install prompt if iOS not standalone.
4. **Subscription:** `subscribeToPush(extension)` → `PushManager.subscribe()` → `POST /api/push/subscribe` with `{extension, subscription.toJSON()}`.
5. **SW message listener:** `setupServiceWorkerListener(onIncomingCall)` — handles `incoming-call-action` messages from SW.

### Service Worker (sw.js)

- **`push` event:** Parses payload `{title, body, from, callId, url}`. Wakes open clients via `postMessage({type: 'incoming-call-action', action: 'wakeup', ...})`. Shows notification with Answer/Reject actions.
- **`notificationclick` event:** Posts action (`answer`/`reject`) to the focused client. Uses 1500ms delay for page-load reliability on cold-start.

### Push server backend (push-server/)

| Endpoint | Purpose |
|---|---|
| `POST /api/push/subscribe` | Store subscription by extension |
| `POST /api/push/unsubscribe` | Remove subscription |
| `POST /api/push/notify` | Trigger push for an extension (called by Kamailio/PBX) |
| `GET /api/push/vapid-public-key` | Return VAPID public key to frontend |
| `GET /api/push/subscriptions` | Admin: list subscriptions |
| `POST /api/logs/mobile` | Ingest device metadata/logs |
| `GET /api/logs/mobile` | Admin: list device logs |
| `GET /dashboard` | Admin dashboard (WireGuard-only) |
| `GET /health` | Health check |

**Access control:** Admin endpoints (`/dashboard`, `/api/logs/*`) are restricted to WireGuard/localhost IPs via `src/middleware/accessControl.js`.

### Mobile recovery (when client was asleep)

1. SW receives push → wakes all clients via postMessage
2. `runtime/swWakeHandler.js` receives message → detects not registered → calls `startAndRegister()`
3. After registration, the incoming INVITE arrives (Kamailio retries)
4. `handleIncomingCallIsolated` processes it, shows alert
5. User taps Answer/Reject in notification → SW posts action → client executes

---

## 11. Media Handling

### Codec enforcement

**File:** `www/app/sdp.js` — `g711OnlyModifier(description)`

Strips all non-G.711 and non-DTMF codecs from SDP. Enforced on both outgoing (Inviter options) and incoming (Invitation accept options).

Config: `G711_ONLY = true` in `www/app/config.js`. **Do not set to false** without testing codec negotiation end-to-end with Kamailio + RTPEngine.

### Microphone access

**File:** `www/app/media.js` — `ensureMicAccess()`

Singleton mic stream. Acquired once and reused for all calls. Stops stream on hangup via `stopLocalAudioStream()`.

### Remote audio

- **Outgoing:** `app/outgoing/media.js` — attaches `remoteAudio` element from session's PeerConnection
- **Incoming:** `app/incoming/media.js` — same pattern
- **Hold recovery:** `sipHold.js` explicitly re-fetches the receiver track and re-attaches to the `remoteAudio` DOM element after unhold (reliability fix for Kamailio/RTPEngine media restart)

### ICE / TURN

ICE servers built in `www/app/config.js`:
- STUN: `stun:{TURN_HOST}:3478`
- TURN: `turn:{TURN_HOST}:3478` (UDP + TCP) and `turns:{TURN_HOST}:5349` (TLS)

`FORCE_RELAY=false` by default. `ICE_TRANSPORT_POLICY` = `"all"` (uses srflx + relay candidates). Set `"relay"` only for strict firewall environments.

### PeerConnection debugging

**File:** `www/app/pc/bind.js` — bound during call establishment. Logs ICE state changes, candidate pairs, and RTP stats to the in-app log panel.

---

## 12. Kamailio / PBX Integration

### SIP proxy role

Kamailio sits between the WebRTC client (WSS) and the FusionPBX/FreeSWITCH backend (UDP SIP). It:
- Terminates WSS WebSocket and translates to SIP/UDP
- Handles REGISTER with digest auth (passed through to PBX)
- Routes INVITEs to RTPEngine for media anchoring
- Maps multiple PBX domains (load balancing)

### Route files

```
kamailio/routes/
  10-incoming.cfg     Incoming call routing decisions
  11-outgoing.cfg     Outgoing call routing
  30-dialog-relay.cfg Dialog relay + RTPEngine media hooks
  50-domain-map.cfg   Multi-domain PBX mapping (PBX_MAP_1_DOMAIN, etc.)
  60-media.cfg        RTPEngine offer/answer integration
```

### Push trigger

Kamailio calls `POST http://127.0.0.1:3001/api/push/notify` (push server internal port) when a client is offline and an INVITE arrives. The push server then sends the web push notification.

### Multi-domain

Multiple PBX backends are configured via `.env` `PBX_MAP_N_DOMAIN` / `PBX_MAP_N_HOST` pairs, rendered into `kamailio/local.cfg` and used in `routes/50-domain-map.cfg`.

---

## 13. Platform-Specific Notes

### Desktop

- Standard push via `Notification` API + SW
- No wake lock needed
- Bootstrap: `runtime/desktop/bootstrapDesktop.js`

### Android PWA

- Requires "Add to Home Screen" for reliable push
- Wake lock (`WakeLockManager` in `runtime/wakeLockManager.js`) prevents screen sleep during calls
- 150-second periodic re-registration to maintain SIP connection during background
- Bootstrap: `runtime/android/bootstrapAndroid.js`

### iOS PWA

- **Must be installed as home screen app** for push to work (Apple restriction)
- Push uses same VAPID flow (iOS 16.4+ Safari required)
- Post-login phantom call gate (3s grace period in `incoming/handlers.js`) is essential — iOS sometimes fires INVITE immediately after REGISTER
- No wake lock support on iOS; relies on push re-registration
- Bootstrap: `runtime/ios/bootstrapIos.js`

---

## 14. Known Architectural Decisions

| Decision | Reason |
|---|---|
| G.711-only SDP | Simplifies codec negotiation across Kamailio+RTPEngine; avoids Opus transcoding |
| Dual-state approach (primary/secondary `st`) | Allows two simultaneous SIP.js sessions on the same UA without interference |
| Platform-specific bootstraps | iOS/Android/Desktop have meaningfully different push, registration, and media lifecycles |
| REFER+Replaces for conference | Standard SIP attended transfer; FusionPBX handles the bridge — no client-side mixing |
| Post-unhold RTP recovery re-INVITE | RTPEngine sometimes doesn't restart media stream after re-INVITE; a second re-INVITE with iceRestart forces RTP re-negotiation |
| 3s and 5s incoming call gates | Hard-coded defenses against iOS phantom INVITEs — validated in production |
| 150s re-registration interval | Kamailio registration expiry + Android background kill threshold balance |

---

## 15. Do-Not-Break Areas

1. **Incoming call phantom gates** (`incoming/handlers.js:GATE 1-4`) — removing causes iPhone ringing during/after login
2. **g711OnlyModifier on both answer and invite** — removing may cause codec mismatch with RTPEngine
3. **Post-unhold RTP recovery** (`sipHold.js`) — removing causes silent calls after unhold on some network paths
4. **dualSessionManager.removeSession promotion logic** — secondary → primary promotion must remain or second call is lost on primary hangup
5. **SW push event: wake clients before showNotification** — order matters; clients must be woken before notification is shown for action routing
6. **Admin endpoint WireGuard guard** — `accessControl.js` must stay; dashboard exposes device metadata
7. **Template-based config injection** — never hardcode domain/IP in source; always use `.env` → template → generated file

---

## 16. Debugging Starting Points

| Symptom | Where to look |
|---|---|
| Registration fails | `registration/primary.js` `buildUserAgent()`, `kamailio/local.cfg` auth settings |
| Outgoing call no audio | `config.js` ICE servers, `sdp.js` codec filtering, RTPEngine logs |
| Incoming call not ringing | SW push delivery, `incoming/handlers.js` gate checks, Kamailio `10-incoming.cfg` |
| Hold/unhold silent | `sipHold.js` post-unhold recovery, Kamailio `30-dialog-relay.cfg` RTPEngine in-dialog |
| Conference fails | `dualSessionManager.conference()` REFER/Replaces headers, FusionPBX attended transfer config |
| Push not arriving | `push-server` logs, SW registration state, VAPID keys match `.env` |
| iOS phantom ringing | Gate timestamps (`registrationCompleteTime`, page load time) in `incoming/handlers.js` |
| Second call drops on swap | `dualSessionManager.swap()` hold sequencing, `sipHold.js` race condition guard |
