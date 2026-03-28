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

## Debugging

| Symptom | Check |
|---|---|
| Registration fails immediately | WSS URL in `dom.js` `normalizeWssServer()`, Nginx/Kamailio WSS config |
| Auth error (401/403) | `authorizationUsername` value, FusionPBX extension credentials |
| Re-registration loop | Transport listener firing before `registered=true` is set |
| iOS phantom calls after login | `setRegistrationComplete()` called from `onRegister`, GATE 2 timing |
| Registration drops when app backgrounds | Check 150s interval is running, Kamailio expiry alignment |
| Push recovery fails to register | `push/recoverySession.js` credential retrieval, `startAndRegister()` in `mobileRecovery.js` |
