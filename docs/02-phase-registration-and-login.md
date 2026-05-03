# 02 — Phase: Registration and Login
_Derived from actual code. Update when registration or auth logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working (all platforms)

---

## Scope of this phase

- SIP UserAgent construction
- REGISTER flow and handler lifecycle
- Transport listener (auto-reconnect, auto-re-register)
- Periodic re-registration (Android background keep-alive)
- Platform-specific registration differences
- Credential persistence and recovery
- `setRegistrationComplete()` timestamp (guards incoming phantom calls)

---

## Key files

| File | Role |
|---|---|
| `www/app/registration/state.js` | `createAppState()` — creates the `st` object |
| `www/app/registration/primary.js` | Main registration logic: `startPrimaryRegistration()`, `buildUserAgent()` |
| `www/app/registration/secondary.js` | SBC fallback (disabled) |
| `www/app/registration/regDiag.js` | Registration diagnostics — step/error state machine, widget renderer |
| `www/app/registration/regDiagCatalog.js` | Shared error catalog — `shortLabel` (frontend) + full technical fields |
| `www/app/runtime/registerFlow.js` | Shared `startAndRegister()` used by all platforms |
| `www/app/runtime/desktop/registrationDesktop.js` | Desktop registration entry |
| `www/app/runtime/ios/registrationIos.js` | iOS registration entry |
| `www/app/runtime/android/registrationAndroid.js` | Android registration entry |
| `www/app/incoming/handlers.js` | Exports `setRegistrationComplete()` |
| `www/app/push/recoverySession.js` | `saveSessionPassword()` for mobile push recovery |

---

## App state object

Created by `createAppState()` in `registration/state.js`. Every bootstrap creates one and passes it (`st`) to all modules.

```js
{
  ua: null,               // SIP.js UserAgent (set by buildUserAgent)
  sbcUa: null,            // Secondary SBC UA — intentionally disabled
  reg: null,              // Active Registerer instance
  registered: false,      // True after onRegister fires
  registering: false,     // True while in-flight, prevents double-register
  session: null,          // Active Inviter or Invitation (set by call modules)
  incomingInvitation: null,
  account: null,          // { username, domain, rawUsername }
}
```

---

## UserAgent construction — buildUserAgent()

**File:** `www/app/registration/primary.js`

```js
st.ua = new SIP.UserAgent({
  uri: SIP.UserAgent.makeURI(`sip:${ext}@${domain}`),
  authorizationUsername: ext,
  authorizationPassword: pass,
  sipExtension100rel: "Supported",
  transportOptions: {
    server: wss,            // wss://{DOMAIN}/ws
    connectionTimeout: 8,   // seconds
    keepAliveInterval: 15,  // seconds (aggressive)
    keepAliveDebounce: 3,   // seconds
  },
  reconnectionAttempts: 999,   // effectively infinite
  reconnectionDelay: 2,        // seconds
  sessionDescriptionHandlerFactoryOptions: {
    peerConnectionConfiguration: {
      iceServers: ICE_SERVERS,
      iceTransportPolicy: ICE_TRANSPORT_POLICY
    }
  },
  delegate: {
    onInvite: (invitation) => handleIncomingCallIsolated(SIP, st, ui, invitation)
  }
});
```

ICE server list is built in `www/app/config.js` from `window.APP_CONFIG` (injected from `.env` via template).

---

## Registration flow — startPrimaryRegistration()

**File:** `www/app/registration/primary.js`

1. Validate credentials (extension, domain, password)
2. `buildUserAgent(SIP, st, ui, account, pass, wss)` → sets `st.ua`
3. `st.ua.start()` → opens WSS connection
4. Create `Registerer` → `st.reg = new SIP.Registerer(st.ua, options)`
5. Attach REGISTER response delegate:
   - `onRegister` → set `st.registered = true`, call `setRegistrationComplete()`, update UI
   - `onUnregister` → set `st.registered = false`, update UI
   - `onRegisterFailed` → log, update UI
6. `st.reg.register()` → sends REGISTER
7. `attachTransportListener(st, ui)` → monitors transport state
8. `saveSessionPassword(pass, ext)` → stores credentials for mobile push recovery
9. `startPeriodicReregistration(st)` → 150s interval (Android background keep-alive)

---

## Transport listener — auto-reconnect behavior

**File:** `www/app/registration/primary.js` — `attachTransportListener(st, ui)`

```
transport state → Connected:
  if not registered and not registering → auto-register

transport state → Disconnected / Disconnecting:
  if no active call or incoming invitation:
    st.registered = false
  (keeps registered=true during active calls to prevent UI flicker)
```

The UA itself handles WebSocket reconnection (999 attempts, 2s delay). The transport listener only handles the REGISTER re-send after reconnect.

---

## Periodic re-registration (Android background)

`setInterval(() => { st.reg.register() }, 150_000)` runs while registered. This prevents Android from killing the SIP registration when the app is backgrounded.

**Do not increase this interval** — Kamailio's registration expiry is set to coordinate with this timing.

---

## setRegistrationComplete() — the phantom-call guard anchor

`setRegistrationComplete()` is exported from `incoming/handlers.js` and called from `primary.js` on `onRegister`.

It sets `lastRegistrationCompleteTime = Date.now()`.

The incoming call handler (`handleIncomingCallIsolated`) reads this timestamp and **rejects any call arriving within 3 seconds** of registration completing (GATE 2). This is the primary fix for iOS phantom INVITEs after login.

**Do not remove or delay this call.**

---

## Platform differences

### Desktop
- Standard registration, no wake lock
- Credential save for dashboard only (not for push recovery)
- Push subscription happens silently after registration

### Android
- 150s periodic re-registration (shared with iOS)
- Wake lock (`wakeLockManager.js`) acquired during calls
- Push recovery: after SW wakes client, `mobileRecovery.js` calls `startAndRegister()` before the INVITE arrives

### iOS
- Same 150s periodic re-registration
- Push recovery same pattern as Android
- **Must be home screen app** for push to trigger SW wake
- After registration, 3s grace period gate blocks phantom INVITEs (validated in production)

---

## Secondary SBC registration (disabled)

`registration/secondary.js` implements a fallback registration to a secondary SBC domain using `st.sbcUa`. It is **not started** in any current bootstrap. Leave it disabled until secondary SBC infrastructure is provisioned.

---

## Credentials persistence

`push/recoverySession.js` — `saveSessionPassword(pass, ext)` stores encrypted credentials in `localStorage` for mobile push recovery (when the app is woken by a push and must re-register before answering).

---

## Mobile Network Compatibility Mode

**File:** `www/app/features/mobileNetworkMode.js`

An optional user-controlled toggle for LTE/5G environments where ICE/STUN fails through carrier CGNAT.

- **Toggle:** "LTE/5G Mode" button below the Register button in the registration card
- **Storage:** `localStorage` key `webrtc_mobile_compat_mode`
- **Effect:** When enabled, `buildUserAgent()` uses `iceTransportPolicy: "relay"` instead of `ICE_TRANSPORT_POLICY` from `config.js`
- **Scope:** Only affects ICE policy at UA construction time. All other registration behavior is unchanged
- **Init:** `initMobileCompatToggle()` called from `bootstrapPage.js` after layout render (all platforms)
- **Log:** Debug panel shows `ICE policy=relay (LTE/5G compat)` when active

This is a genuine relay-mode flag — not an encryption feature. Normal Wi-Fi users should leave it off.

## LTE/mobile registration stability (2026-03-28)

Three server-side/client-side changes that improve LTE registration reliability:

1. **Nginx `proxy_buffering off` on `/ws`** — ensures Kamailio ping/pong frames are forwarded immediately without Nginx output buffering. Required for WebSocket keepalive to work reliably through carrier CGNAT.

2. **SIP.js `connectionTimeout: 15s`** — increased from 8s to give LTE TLS cold-start (DNS + TCP + TLS handshake) enough headroom. Only slows failure detection on broken connections; no behavioral change on working ones.

3. **Kamailio `keepalive_timeout: 20s`** — reduced from 30s to ping the WS connection more frequently, staying inside the 30–60s NAT table expiry window of most LTE carriers.

## Registration diagnostics

**Module:** `www/app/registration/regDiag.js`

Structured step and error codes are emitted at each observable point in the registration flow and rendered as a compact widget below the LTE/5G Mode button on the login card.

- Step codes REG-001–REG-010 advance as the flow progresses
- Error codes REG-E001–REG-E009 halt the step display with a red indicator
- A Trace ID (`T-XXXXXX`) is generated per attempt — include in support reports
- Widget auto-hides 3s after REG-010 (success)

**Frontend display rules:** The login widget shows only user-safe text — no SIP, WSS, Kamailio, PBX, or transport names. Error state shows `Registration failed` + `REG-Exxx: shortLabel`. Technical detail is in `console.debug` only (visible in browser devtools, not in the UI).

**Admin page:** Full technical catalog at `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/diagnostics/errors` (WireGuard-only). Shows long descriptions, likely layers, causes, recommended checks.

**Shared catalog:** `regDiagCatalog.js` (ES module) and `push-server/src/diagCatalog.js` (CommonJS) mirror the same catalog. Keep in sync.

**REG-008/009 not wired:** SIP.js handles the 401 Digest challenge→retry internally. These codes are reserved for future server-side Kamailio logging (KAM-004/005).

Full code reference and KAM server-side recommendations: [10-registration-diagnostics-and-error-codes.md](10-registration-diagnostics-and-error-codes.md)

---

## Debugging

| Symptom | Check |
|---|---|
| Registration fails immediately | WSS URL in `dom.js` `normalizeWssServer()`, Nginx/Kamailio WSS config |
| Auth error (401/403) | `authorizationUsername` value, FusionPBX extension credentials |
| Re-registration loop | Transport listener firing before `registered=true` is set |
| iOS phantom calls after login | `setRegistrationComplete()` called from `onRegister`, GATE 2 timing |
| Registration drops when app backgrounds | Check 150s interval is running, Kamailio expiry alignment |
| Push recovery fails to register | `push/recoverySession.js` credential retrieval, `startAndRegister()` in `mobileRecovery.js` |
| Registration fails only on LTE | Check nginx `proxy_buffering off` in `/ws`, Kamailio keepalive_timeout, SIP.js connectionTimeout |
| No audio only on LTE (registration OK) | Enable LTE/5G Compatibility Mode (forces TURN relay), check TURN credentials and coturn reachability |
