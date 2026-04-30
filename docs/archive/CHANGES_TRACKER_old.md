# CHANGES_TRACKER.md
**WebRTC SIP Softphone — Current Status & Change Log**
_Keep this file updated. It is the live state of the project._
_Last updated: 2026-03-28_

---

## Current Feature Status

| Feature | Status | Notes |
|---|---|---|
| SIP Registration (Desktop/Android/iOS) | ✅ Working | Phantom-call gates active |
| Outgoing calls | ✅ Working | G.711-only SDP enforced |
| Incoming calls | ✅ Working | Gates protect against phantom INVITEs |
| Hold / Unhold | ✅ Working | Post-unhold RTP recovery active |
| Add call (dual session) | ✅ Working | Holds primary, dials secondary |
| Swap (toggle active session) | ✅ Working | dualSessionManager.swap() |
| Conference (attended transfer) | ✅ Working | REFER+Replaces → FusionPBX bridge |
| Push notifications — Android | ✅ Working | Requires home screen install |
| Push notifications — iOS | ✅ Working | Requires iOS 16.4+ home screen install |
| Push notifications — Desktop | ✅ Working | Standard browser push |
| DTMF | ✅ Working | RTCDTMFSender via callControls.js |
| Call history (local) | ✅ Working | localStorage-based |
| Remote device logging | ✅ Working | Device fingerprint + metadata to push-server |
| Admin dashboard | ✅ Working | WireGuard-only at http://10.252.253.15:8081/dashboard |
| Multi-domain PBX | ✅ Working | env-driven domain map in kamailio |
| Conference room PIN join | ⚠️ Partial | `CONFERENCE_FEATURE_ENABLED=false` in .env; backend exists |
| Env-driven config (no hardcoded values) | ⚠️ Incomplete | See known issues below |

---

## Recently Completed Work (2026-03)

### 2026-03-28 — Documentation Reorganization
- Created `docs/PROJECT_STRUCTURE.md` (authoritative architecture reference)
- Created `docs/CHANGES_TRACKER.md` (this file)
- Created `docs/README.md` (index for new AI/developers)
- Archived historical numbered docs to `docs/archive/`
- No code changes

### 2026-03-12 — DNS/IP Config Refactor
- Refactored DNS/IP/ACL configuration into `.env`
- Updated Kamailio templates to consume new env vars
- See `docs/archive/12-KAMAILIO_DNS_IP.md` for details

### 2026-03-09 — Hold / MOH Resume Fix
- Fixed post-unhold silent call issue (MOH resumed but live audio didn't)
- `sipHold.js` post-unhold RTP recovery: RTP packet count diff → iceRestart re-INVITE if stalled
- See `docs/archive/11-MOH-FIXED.md` for implementation notes

### 2026-03-07 — Major Modular Refactor
- `www/index.html` (924-line monolith) split into `app/layout/`, `app/page/`, `styles/`
- `push-server/server.js` (1275-line monolith) split into `src/` modules
- `www/app/remoteLogs.js` (411 lines) split into `app/remoteLogs/` modules
- `push-server/dashboard.html` split into `src/dashboard/styles.css` + `dashboard.js`
- Dashboard admin endpoints restricted to WireGuard/localhost only

### 2026-03-07 — iOS + Android Call Stability Fixes
- Fixed iPhone phantom ringing after login (3s registration grace period gate)
- Fixed iPhone ringing during login (not-registered gate)
- Fixed Android WebRTC logout + keepalive regression
- Fixed Brave browser import mismatch (`setRegistrationComplete`)
- Fixed manifest icon 404 warnings

### 2026-03-07 — Remote Logging & Device Identity
- Stable device fingerprinting (`browserId` + `deviceFingerprint` + `browserFingerprint`)
- localStorage + cookie fallback for persistent ID
- `sendBeacon` fallback for Safari/iOS hidden-page reliability
- Server-side canonical device resolution + startup deduplication

### 2026-03-06 — History Tab and MOH
- History tab UI added (`ui/historyActivity.js`)
- MOH (music on hold) integration fixed with Kamailio in-dialog RTPEngine

---

## Current Known Issues

### 1. Hardcoded TURN credentials in www/app/config.js
**File:** `www/app/config.js`
```js
TURN_USERNAME = "turnuser"   // fallback hardcoded
TURN_CREDENTIAL = "turnpass"
TURN_HOST = "phone.srve.cc"
```
**Impact:** Low in practice (template injection overrides at runtime), but brittle.
**Fix:** Read from `window.APP_CONFIG` only; remove fallback literals.
**Tracked in:** `docs/archive/PROJECT_AUDIT_TRACKER.md` §3

### 2. Static trusted SIP IP list in Kamailio
**File:** `kamailio/kamailio.cfg` and `kamailio/routes/*.cfg`
Some IP addresses and domain literals not driven by `.env`.
**Fix:** Move all trust IP/domain entries to env vars + template.

### 3. Push server subscriptions are in-memory only
**File:** `push-server/src/services/push/subscriptionStore.js`
Subscriptions lost on push-server restart. Users must reload app to re-subscribe.
**Fix:** Persist to file or Redis.

### 4. Conference feature disabled
`CONFERENCE_FEATURE_ENABLED=false` in `.env`. Backend routes exist, frontend `conference/join.js` is implemented but not activated.
**Fix:** Set env var to `true` and test PIN flow end-to-end.

### 5. Secondary SBC registration disabled
`st.sbcUa` / `registration/secondary.js` exists but is not started in any bootstrap.
**Status:** Intentionally disabled; infrastructure not active.

---

## In-Progress Work

_Nothing currently in progress. Update this section when work starts._

---

## Planned Next Tasks

1. **TURN credential hardcoding fix** — move `www/app/config.js` TURN values to `window.APP_CONFIG` exclusively
2. **Push subscription persistence** — file or Redis-backed store in push-server
3. **Env-hardening for Kamailio** — eliminate remaining static IPs/domains from route files
4. **Conference feature activation** — test and enable `CONFERENCE_FEATURE_ENABLED`
5. **CI hardcoding guard** — grep check in CI to block new domain/IP literals in tracked source paths

---

## Important Warnings for Future Edits

### Do not touch the incoming call gates
`www/app/incoming/handlers.js` — four gates at the top of `handleIncomingCallIsolated()`. These prevent iOS phantom INVITEs from ringing the phone during/after login. Validated in production. Do not remove or loosen timing thresholds.

### Do not remove post-unhold RTP recovery
`www/app/features/sipHold.js` — after sending unhold re-INVITE, the code waits 2.5s and checks RTP packet deltas. If stalled, sends a second re-INVITE with `iceRestart`. This recovers silent calls on specific Kamailio/RTPEngine path combinations. Do not remove.

### Do not edit generated config files directly
`www/index.html`, `kamailio/local.cfg`, `coturn/turnserver.conf`, `rtpengine/rtpengine.conf`, `nginx/phone.srve.cc.conf` are all generated by `make`. Edit the `.template` versions.

### dualSessionManager is a singleton on window
`www/app/features/dualSessionManager.js` exports to `window.dualSessionManager`. It is accessed directly from multiple modules. State leaks across calls if `reset()` is not called on hangup.

### 150s re-registration is intentional
`registration/primary.js` runs a `setInterval` at 150s for Android background keep-alive. Do not increase this interval or registration expires in background.

---

## References to Old Docs

| Topic | Archive file |
|---|---|
| iOS push notification fixes detail | `docs/archive/IPHONE-PUSH-FIX-SUMMARY.md` |
| Hold/MOH implementation runbook | `docs/archive/11-MOH-FIXED.md` |
| Kamailio DNS/IP config detail | `docs/archive/12-KAMAILIO_DNS_IP.md` |
| Push notification full setup | `docs/archive/4-PUSH_NOTIFICATIONS_SETUP.md` |
| Multi-domain PBX setup detail | `docs/archive/7-MULTIPLE_DOMAINS.md` |
| Kamailio modular config | `docs/archive/8-kamailio_modulerised.md` |
| Docker setup/migration | `docs/archive/DOCKER-MIGRATION-COMPLETE.md` |
| Hardcoded value audit | `docs/archive/PROJECT_AUDIT_TRACKER.md` |
| Incoming call routing detail | `docs/archive/PBX-INCOMING-CALL-ROUTING.md` |
| Early media testing notes | `docs/archive/EARLY_MEDIA_TEST.md` |
| Debug log dashboard setup | `docs/archive/Debug_Log_Dashboard.md` |
