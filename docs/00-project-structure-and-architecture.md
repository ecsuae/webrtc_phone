# 00 — Project Structure and Architecture
**WebRTC SIP Softphone — Authoritative Architecture Reference**
_Derived from actual codebase. Update this file when structure or architecture changes._
_Last updated: 2026-03-28_

---

## Purpose

A production WebRTC SIP softphone deployed as a PWA. Browser clients (desktop, Android, iOS) register, dial, and receive calls via SIP.js over WSS. Media is bridged from WebRTC (SRTP) to plain SIP/RTP by Kamailio + RTPEngine. Push notifications wake sleeping mobile clients for incoming calls.

---

## Top-level directory map

```
/opt/webrtc-sbc/
├── www/                  Frontend SPA (browser, Android PWA, iOS PWA)
├── push-server/          Node.js push notification + admin backend
├── kamailio/             SIP proxy configuration
├── rtpengine/            WebRTC ↔ SIP media bridging
├── coturn/               STUN/TURN server
├── nginx/                WSS + HTTPS termination (reverse proxy)
├── certs/                TLS certificates
├── scripts/              Setup + utility scripts
├── docker-compose.yml    Container orchestration
├── Makefile              Template rendering + container lifecycle
├── .env                  Deployment secrets (never committed)
├── .env.example          Required env var template
└── docs/                 Documentation (this directory)
```

---

## Configuration pipeline

The project uses **envsubst + Makefile** to inject `.env` values into generated runtime files. Never edit generated files directly — edit the `.template` versions.

| Template | Generated output |
|---|---|
| `www/index.html.template` | `www/index.html` |
| `kamailio/local.cfg.template` | `kamailio/local.cfg` |
| `coturn/turnserver.conf.template` | `coturn/turnserver.conf` |
| `rtpengine/rtpengine.conf.template` | `rtpengine/rtpengine.conf` |
| `nginx/phone.srve.cc.conf.template` | `nginx/phone.srve.cc.conf` |

Runtime config reaches the browser via `data-*` attributes on `<body>` (set by `index.html` template) → read by `www/config.js` → populates `window.APP_CONFIG` → consumed by `www/app/config.js`.

See [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md) for full env/config detail.

---

## Frontend application structure

### Entry chain

```
www/index.html
  └── www/app/page/bootstrapPage.js      renders layout, then imports main.js
        └── www/app/main.js               platform detection → routes to:
              ├── Android  → runtime/android/bootstrapAndroid.js
              ├── iOS      → runtime/ios/bootstrapIos.js
              └── Desktop  → runtime/desktop/bootstrapDesktop.js
```

### App state object

Every bootstrap creates `st` via `createAppState()` (`www/app/registration/state.js`) and threads it through all modules:

```js
{
  ua: null,               // SIP.js UserAgent
  sbcUa: null,            // Secondary SBC UA (disabled)
  reg: null,              // REGISTER handler
  registered: false,
  registering: false,
  session: null,          // Active Inviter or Invitation
  incomingInvitation: null,
  account: null,          // { username, domain, rawUsername }
}
```

### Module directory map

| Path | Responsibility |
|---|---|
| `app/registration/` | UA creation, REGISTER flow, transport listener, state factory |
| `app/incoming/` | Incoming INVITE gating (4 gates), answer, reject, alert |
| `app/outgoing/` | Outgoing INVITE, hangup, add-call, ringback |
| `app/features/` | `sipHold.js` (hold/unhold), `dualSessionManager.js` (multi-call), `lteCallGuard.js` (ICE relay guard), `callMediaLog.js` (event transport), `mobileNetworkMode.js` (LTE toggle) |
| `app/conference/` | Conference PIN lookup, guest SIP credentials |
| `app/push/` | SW subscription, VAPID, support detection, mobile recovery |
| `app/runtime/desktop/` | Desktop-specific bootstrap, call flow, controls, push |
| `app/runtime/ios/` | iOS-specific bootstrap, call flow, controls, push |
| `app/runtime/android/` | Android-specific bootstrap, call flow, controls, push |
| `app/runtime/` (shared) | `registerFlow.js`, `controlBindings.js`, `swWakeHandler.js`, `wakeLockManager.js` |
| `app/ui/` | `callControls.js`, `callTimer.js`, `historyActivity.js`, `callHistoryLocal.js`, DTMF |
| `app/layout/` | Declarative HTML section renderers (header, dialpad, status bar, etc.) |
| `app/page/` | Page init, dialpad input, cache actions, debug toggle, keyboard |
| `app/pc/` | PeerConnection stats, ICE/RTP debugging |
| `app/util/` | DTMF sender (`RTCDTMFSender` wrapper) |
| `app/remoteLogs/` | Device fingerprinting, log transport, session metadata |
| `app/config.js` | ICE servers, TURN credentials, codec flags, `nowISO()` |
| `app/sdp.js` | `g711OnlyModifier()` — strips non-G.711/DTMF from SDP |
| `app/media.js` | `ensureMicAccess()`, `stopLocalAudioStream()`, singleton mic stream |
| `app/log.js` | In-app log panel + SIP code → human message map |
| `app/dom.js` | DOM selector cache, `normalizeWssServer()` |

---

## Backend: push-server

Express.js service (`push-server/server.js`, ~87 lines) with modular `src/` layout:

```
push-server/src/
  config.js                    VAPID keys, ports, WireGuard settings
  middleware/accessControl.js  IP guard (WireGuard/localhost for admin routes)
  routes/pushRoutes.js         /api/push/* (subscribe, notify, unsubscribe)
  routes/logRoutes.js          /api/logs/mobile (device metadata ingest + admin)
  routes/conferenceRoutes.js   /api/conference/* (PIN lookup, join-details)
  routes/systemRoutes.js       /health, /dashboard serving
  services/push/subscriptionStore.js  In-memory push subscription store
  services/metadata/core.js          Metadata file I/O, canonical identity
  services/metadata/metadataUpdate.js Metadata patch/merge
  services/metadata/dedupe.js        Startup deduplication pass
  dashboard/dashboard.js             Dashboard logic
  dashboard/styles.css               Dashboard CSS
```

Push server starts two listeners:
- Main API: `127.0.0.1:3001` — Nginx proxies `/api/` here; never directly reachable from internet
- Admin: `10.252.253.15:8081` — WireGuard-only; serves `/dashboard` and `/diagnostics/errors`

Both are the same Express app. Admin bind host/port configured via `.env` (`ADMIN_BIND_HOST`, `ADMIN_BIND_PORT`).

---

## Infrastructure components

| Component | Directory | Role |
|---|---|---|
| Kamailio | `kamailio/` | SIP proxy: WSS ↔ UDP, REGISTER relay, INVITE routing, push trigger |
| RTPEngine | `rtpengine/` | WebRTC SRTP ↔ SIP RTP media bridge, NAT traversal |
| CoTURN | `coturn/` | STUN/TURN server (3478 UDP/TCP, 5349 TLS) |
| Nginx | `nginx/` | WSS + HTTPS termination, reverse proxy to www and push-server |

All containers orchestrated by `docker-compose.yml`. Launched and configured via `make`.

---

## Key architectural decisions

| Decision | Reason |
|---|---|
| G.711-only SDP (`g711OnlyModifier`) | Avoids codec negotiation complexity with Kamailio+RTPEngine |
| Dual `st` objects (primary/secondary) | Two SIP.js sessions share one UA without state interference |
| Platform-specific bootstraps | iOS/Android/Desktop have different push, wake lock, and re-registration needs |
| REFER+Replaces for conference | Standard attended transfer; PBX bridges — no client-side audio mixing |
| Post-unhold iceRestart re-INVITE | RTPEngine sometimes stalls after re-INVITE; second re-INVITE with iceRestart recovers media |
| 3s + 5s incoming call gates | iOS fires phantom INVITEs immediately after REGISTER; gates validated in production |
| 150s periodic re-registration | Android background keep-alive vs Kamailio registration expiry |
| Template-driven config | Zero hardcoded deployment values in source; all through `.env` + `make` |
| WireGuard-only dashboard | Device metadata is sensitive; admin routes blocked to internet |

---

## Do-not-break areas

These are production-validated behaviors. Do not remove or change them without understanding the consequence:

1. **4-gate phantom call protection** — `www/app/incoming/handlers.js` top of `handleIncomingCallIsolated()`. See [04-phase-incoming-calls.md](04-phase-incoming-calls.md).
2. **G.711-only codec filter** — `g711OnlyModifier` applied on both Inviter and Invitation. See [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md).
3. **Post-unhold RTP recovery** — `sipHold.js` 2.5s wait + iceRestart re-INVITE. See [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md).
4. **dualSessionManager.removeSession promotion** — secondary promoted to primary on hangup. See [09-phase-dual-session-and-conference.md](09-phase-dual-session-and-conference.md).
5. **SW push wake order** — clients woken via postMessage *before* `showNotification()`. See [06-phase-push-notifications.md](06-phase-push-notifications.md).
6. **WireGuard guard on admin endpoints** — `accessControl.js` must remain. See [07-phase-kamailio-rtpengine-nginx.md](07-phase-kamailio-rtpengine-nginx.md).
7. **Template-only config** — never edit generated files (`index.html`, `local.cfg`, etc.). See [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md).

---

## Phase/function document index

| Doc | Phase covered |
|---|---|
| [02-phase-registration-and-login.md](02-phase-registration-and-login.md) | SIP UA, REGISTER, transport, platform-specific auth |
| [03-phase-outgoing-calls.md](03-phase-outgoing-calls.md) | Outgoing INVITE, ringback, early media, hangup |
| [04-phase-incoming-calls.md](04-phase-incoming-calls.md) | Incoming INVITE gates, answer, reject, alert |
| [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md) | Codec, mic, remote audio, hold/unhold, MOH, RBT |
| [06-phase-push-notifications.md](06-phase-push-notifications.md) | SW, VAPID, subscription, mobile wake recovery |
| [07-phase-kamailio-rtpengine-nginx.md](07-phase-kamailio-rtpengine-nginx.md) | SIP proxy, media engine, nginx, deployment |
| [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md) | .env pipeline, multi-PBX domain, hardcoding issues |
| [09-phase-dual-session-and-conference.md](09-phase-dual-session-and-conference.md) | Add call, swap, conference REFER+Replaces |
| [11-admin-routing-config.md](11-admin-routing-config.md) | Admin routing config page, routing-config.json, make routing-apply |
| [12-lte-media-diagnostics.md](12-lte-media-diagnostics.md) | LTE no-audio root cause, MEDIA error codes, relay guard, call media event log |

---

## Debugging quick-reference

| Symptom | Starting point |
|---|---|
| Registration fails | `registration/primary.js` `buildUserAgent()`, `kamailio/local.cfg` |
| Outgoing — no audio | `app/config.js` ICE servers, `sdp.js` codec filter, RTPEngine logs |
| Incoming — not ringing | SW push delivery, `incoming/handlers.js` gate check, `kamailio/routes/10-incoming.cfg` |
| Hold/unhold — silent after unhold | `sipHold.js` post-unhold recovery, `kamailio/routes/30-dialog-relay.cfg` |
| Conference fails | `dualSessionManager.conference()` REFER/Replaces, FusionPBX transfer config |
| Push not arriving | `push-server` logs, SW registration state, VAPID keys in `.env` |
| iOS phantom ringing | Gate timestamps in `incoming/handlers.js`, `setRegistrationComplete()` call |
| Swap drops a call | `dualSessionManager.swap()` hold sequencing, `sipHold.js` concurrency guard |
| Second call lost after primary hangs up | `dualSessionManager.removeSession()` secondary promotion |
