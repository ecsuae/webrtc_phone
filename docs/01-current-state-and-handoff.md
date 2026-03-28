# 01 — Current State and Handoff
**WebRTC SIP Softphone — Live Status, Active Work, Known Issues**
_Update this file after every meaningful change. It is the live state of the project._
_Last updated: 2026-03-28_

---

## Current feature status

| Feature | Status | Key files |
|---|---|---|
| SIP Registration — Desktop | ✅ Working | `registration/primary.js`, `runtime/desktop/` |
| SIP Registration — Android | ✅ Working | `registration/primary.js`, `runtime/android/` |
| SIP Registration — iOS | ✅ Working | `registration/primary.js`, `runtime/ios/` |
| Outgoing calls | ✅ Working | `outgoing/call.js` |
| Incoming calls | ✅ Working | `incoming/handlers.js` (4 gates active) |
| Hold / Unhold + MOH recovery | ✅ Working | `features/sipHold.js` |
| Ringback tone | ✅ Working | `outgoing/ringback.js` |
| Early media (183 SDP) | ✅ Working | `outgoing/call.js` onProgress handler |
| Add call (dual session) | ✅ Working | `outgoing/addCall.js`, `dualSessionManager` |
| Swap (active ↔ held) | ✅ Working | `dualSessionManager.swap()` |
| Conference (attended transfer) | ✅ Working | `dualSessionManager.conference()` REFER+Replaces |
| DTMF in-call | ✅ Working | `ui/callControls.js`, `util/dtmf.js` |
| Call history (local) | ✅ Working | `ui/callHistoryLocal.js` (localStorage) |
| Push notifications — Desktop | ✅ Working | `push/support.js`, `sw.js` |
| Push notifications — Android | ✅ Working | Requires home screen install |
| Push notifications — iOS | ✅ Working | Requires iOS 16.4+ home screen install |
| Remote device logging | ✅ Working | `remoteLogs/` + push-server `/api/logs/mobile` |
| Admin dashboard | ✅ Working | WireGuard-only: `http://10.252.253.15:8081/dashboard` |
| Multi-domain PBX routing | ✅ Working | `kamailio/routes/50-domain-map.cfg`, `.env` PBX_MAP |
| Conference room PIN join | ⚠️ Partial | `CONFERENCE_FEATURE_ENABLED=false`; backend + frontend exist |
| Env-driven config (zero hardcoding) | ⚠️ Incomplete | TURN fallbacks still hardcoded in `app/config.js` |
| Secondary SBC registration | 🚫 Disabled | `registration/secondary.js` exists but not started |

---

## Current branch

**Branch:** `callcontrol`
**Status:** Active development

**Recent commits:**
- `6ae27e4` Refactored code for DNS/IPS/ACLS in .env file
- `8f2afcc` Refactored code for DNS/IPS/ACLS in .env file
- `8ab6ca4` feat(ui): password eye toggle + in-call DTMF keypad; config dial max digits
- `ca66b61` history tab
- `09fdf59` fixed MOH and history tab

---

## Recently completed work

### 2026-03-28 — Documentation restructure
- Created phase/function doc structure (`00`–`09` + README)
- Archived previous `PROJECT_STRUCTURE.md` and `CHANGES_TRACKER.md` to `archive/`
- `ai-working-rules.md` preserved untouched
- No code changes in this session

### 2026-03-12 — DNS/IP/ACL config refactor
- TRUSTED_SIP_IP, DNS entries, ACL values moved to `.env`
- Kamailio templates updated to consume new env vars
- Detail: `docs/archive/12-KAMAILIO_DNS_IP.md`

### 2026-03-09 — Hold / MOH resume fix
- Post-unhold RTP recovery added to `sipHold.js`
- Mechanism: snapshot RTP packet counts before/after 2.5s wait; if stalled → iceRestart re-INVITE
- Detail: `docs/archive/11-MOH-FIXED.md`

### 2026-03-07 — Major modular refactor
- `www/index.html` (924 lines) → split into `app/layout/`, `app/page/`, `styles/`
- `push-server/server.js` (1275 lines) → split into `src/` modules
- `www/app/remoteLogs.js` (411 lines) → split into `app/remoteLogs/`
- Dashboard: WireGuard-only access enforced

### 2026-03-07 — iOS + Android stability fixes
- GATE 2 (3s post-registration grace period) added to `incoming/handlers.js` — stops iPhone phantom calls after login
- GATE 1 (not-registered check) hardened
- Android WebRTC logout + keepalive regression fixed
- Brave browser import mismatch fixed (`setRegistrationComplete`)

### 2026-03-06 — History tab + MOH initial fix
- Call history tab added (`ui/historyActivity.js`)
- MOH integrated with Kamailio in-dialog RTPEngine

---

## In-progress work

_Nothing currently in progress. Update this section when a new task starts._

---

## Known issues

### 1. Hardcoded TURN credentials in www/app/config.js
**File:** `www/app/config.js`
```js
// These fallback literals should not exist — read from window.APP_CONFIG only
TURN_USERNAME = "turnuser"
TURN_CREDENTIAL = "turnpass"
TURN_HOST = "phone.srve.cc"
```
**Impact:** Low in practice (template injection overrides at runtime), but brittle.
**Fix:** Remove fallback literals; read exclusively from `window.APP_CONFIG`.
**Context:** `docs/archive/PROJECT_AUDIT_TRACKER.md` §3

### 2. Static trusted SIP IPs in Kamailio
**Files:** `kamailio/kamailio.cfg`, `kamailio/routes/*.cfg`
Some domain and IP literals not yet env-driven.
**Fix:** Move remaining trust entries to `.env` + template.

### 3. Push subscriptions are in-memory only
**File:** `push-server/src/services/push/subscriptionStore.js`
Subscriptions lost on push-server restart. Users must reload to re-subscribe.
**Fix:** Persist to flat file or Redis.

### 4. Conference room PIN join disabled
`CONFERENCE_FEATURE_ENABLED=false` in `.env`. Frontend `conference/join.js` and backend `conferenceRoutes.js` are implemented but not active.
**Fix:** Set env var to `true`, test PIN → guest credential flow end-to-end.

### 5. Secondary SBC registration intentionally disabled
`registration/secondary.js` exists but never called. Infrastructure not active.
**Status:** Leave disabled until SBC is provisioned.

---

## Planned next tasks

1. **TURN credential hardcoding** — remove fallback literals from `www/app/config.js`
2. **Push subscription persistence** — file/Redis-backed store in push-server
3. **Kamailio env-hardening** — remove remaining static IPs/domains from route files
4. **Conference PIN activation** — enable `CONFERENCE_FEATURE_ENABLED` and test end-to-end
5. **CI hardcoding guard** — grep check blocking new domain/IP literals in source

---

## Active warnings for any new AI session

### GATE 1–4 in incoming/handlers.js — do not remove or loosen
`www/app/incoming/handlers.js` — four rejection gates at the top of `handleIncomingCallIsolated()`.
- GATE 1: not registered → reject 480
- GATE 2: < 3s since `setRegistrationComplete()` → reject 480 (iOS phantom after login)
- GATE 3: < 5s since page load → reject 480 (startup protection)
- GATE 4: session already active → reject 486 Busy

All four are validated in production. Detail: [04-phase-incoming-calls.md](04-phase-incoming-calls.md).

### Post-unhold RTP recovery — do not remove
`www/app/features/sipHold.js` — after sending unhold re-INVITE, waits 2.5s, checks RTP packet delta. If stalled → iceRestart re-INVITE. Removing this causes silent calls on some Kamailio/RTPEngine paths. Detail: [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md).

### dualSessionManager is a window singleton — reset() on hangup is critical
`window.dualSessionManager` — state leaks across calls if `reset()` or `removeSession()` is not called on termination. Detail: [09-phase-dual-session-and-conference.md](09-phase-dual-session-and-conference.md).

### 150s re-registration interval — do not increase
`registration/primary.js` `setInterval` at 150s keeps Android SIP registration alive in background. Increasing this causes registration to expire before next keepalive fires. Detail: [02-phase-registration-and-login.md](02-phase-registration-and-login.md).

### Never edit generated config files
`www/index.html`, `kamailio/local.cfg`, `coturn/turnserver.conf`, `rtpengine/rtpengine.conf`, `nginx/phone.srve.cc.conf` — all generated by `make`. Edit `.template` versions. Detail: [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md).

### G.711-only on both sides — do not remove g711OnlyModifier
Applied to both Inviter (outgoing) and Invitation accept (incoming). Removing causes codec mismatch at RTPEngine. Detail: [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md).

---

## Handoff template for next session

When handing off to a new AI, provide this block:

```
Task: [describe the specific task]
Branch: callcontrol
Read first:
  1. docs/ai-working-rules.md
  2. docs/00-project-structure-and-architecture.md
  3. docs/01-current-state-and-handoff.md
  4. docs/[relevant phase doc]
Current status: [anything in-progress from above]
Warnings: [any specific fragile areas relevant to the task]
Do not touch: [list any areas explicitly out of scope]
```
