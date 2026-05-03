# 01 — Current State and Handoff
**WebRTC SIP Softphone — Live Status, Active Work, Known Issues**
_Update this file after every meaningful change. It is the live state of the project._
_Last updated: 2026-03-29 (rev 2)_

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
| Admin dashboard | ✅ Working | WireGuard-only: `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/dashboard` |
| Multi-domain PBX routing | ✅ Working | `kamailio/routes/50-domain-map.cfg`, `.env` PBX_MAP |
| Conference room PIN join | ⚠️ Partial | `CONFERENCE_FEATURE_ENABLED=false`; backend + frontend exist |
| Env-driven config (zero hardcoding) | ⚠️ Incomplete | TURN fallbacks still hardcoded in `app/config.js` |
| Secondary SBC registration | 🚫 Disabled | `registration/secondary.js` exists but not started |
| Registration diagnostics (frontend) | ✅ Working | `registration/regDiag.js`; user-safe labels; step codes REG-001–010 wired |
| Registration error admin page | ✅ Working | `push-server` port 8081 `/diagnostics/errors`; WireGuard-only |
| Admin listener on port 8081 | ✅ Working | `ADMIN_BIND_HOST:ADMIN_BIND_PORT`; second `app.listen()` in server.js |
| Kamailio KAM server-side tracing | ✅ Working | `kamailio.cfg`, `routes/20-registration.cfg`, `routes/40-replies.cfg`; KAM-001–006 + KAM-E001–E004 |
| LTE media relay path | ⚠️ Partial | RTPEngine `--interface=eth0!PUBLIC_IP` used; `media-address` flag reverted from shared paths (caused Wi-Fi regression) |
| Admin routing config page | ✅ Working | `push-server` port 8081 `/admin/routing`; WireGuard-only; writes `routing-config.json` |
| LTE relay readiness guard | ✅ Working | `features/lteCallGuard.js`; pre-flight TURN check before INVITE; MEDIA-E001/E002 on relay failure; user-safe UI message |
| Call media event logging | ✅ Working | `features/callMediaLog.js` → `POST /api/logs/call`; admin filter at `/admin/calllogs` |

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

## Recently completed work (continued)

### 2026-03-28 — LTE/4G registration fix + Mobile Network Compatibility Mode

**Root causes identified:**
1. Nginx `/ws` was missing `proxy_buffering off` — delayed WebSocket ping/pong frames under carrier CGNAT, causing silent TCP drops on mobile networks
2. SIP.js `connectionTimeout: 8s` was marginal for LTE TLS cold-start latency
3. Kamailio `keepalive_timeout: 30s` was at the edge of LTE CGNAT NAT table expiry

**Changes made:**
- `nginx/site.conf.template` — added `proxy_buffering off`, `X-Real-IP` header on `/ws`, IPv6 listeners (`listen [::]:443 ssl`, `listen [::]:80`)
- `kamailio/kamailio.cfg` — `keepalive_timeout 30` → `20` (10s safety margin against CGNAT)
- `www/app/registration/primary.js` — `connectionTimeout: 8` → `15` (LTE cold-start headroom)
- `www/app/features/mobileNetworkMode.js` — NEW: isolated LTE/5G Compatibility Mode module
- `www/app/layout/registrationSection.js` — added opt-in "LTE/5G Mode" toggle button
- `www/app/page/bootstrapPage.js` — wires `initMobileCompatToggle()` on page boot
- `www/styles/forms-buttons.css` — toggle button styles
- `make render` run — nginx config regenerated

**Mobile Network Compatibility Mode:**
- Optional toggle below the Register button, labeled "LTE/5G Mode"
- When ON: forces `iceTransportPolicy: "relay"` (all media via TURN) at UA construction time
- When OFF: normal behavior, no change for Wi-Fi users
- Persisted in `localStorage` key `webrtc_mobile_compat_mode`
- Logged in debug panel: `ICE policy=relay (LTE/5G compat)` when active

**IPv6 note:** Server has IPv6 but `${DOMAIN}` may have no AAAA DNS record — so IPv6 connectivity was not the current failure. Nginx IPv6 listeners added for future-proofing when AAAA record is added.

---

## Recently completed work (continued)

### 2026-03-28 — Registration diagnostics state machine

Added structured step/error codes surfaced in the login UI so registration failures can be triaged without server access.

**Changes made:**
- `www/app/registration/regDiag.js` — NEW isolated diagnostics module: step/error state machine, widget renderer, connect/response timers
- `www/app/layout/registrationSection.js` — added `<div id="regDiagWidget">` placeholder below LTE/5G Mode button
- `www/app/registration/primary.js` — wired `diagInit()`, `diagStep()`, `diagError()` calls at each observable registration point
- `www/styles/forms-buttons.css` — added `.diag-*` CSS classes for widget
- `docs/10-registration-diagnostics-and-error-codes.md` — NEW: full code reference and Kamailio/Nginx KAM code recommendations

**Step codes wired:** REG-001 (config loaded) → REG-004 (UA created) → REG-005 (connecting) → REG-006 (connected) → REG-007 (REGISTER sent) → REG-010 (registered)

**Error codes wired:** REG-E001 (bad input), REG-E002 (missing config), REG-E003 (connect timeout), REG-E004 (WSS drop), REG-E005 (no SIP response), REG-E006 (auth rejected), REG-E007 (DNS failure), REG-E008 (TLS error), REG-E009 (PBX 5xx)

**Note:** REG-008/009 (auth challenge cycle) not wired — SIP.js handles 401→retry internally with no hook.

**Frontend display:** Error widget shows only user-safe text — "Registration failed" + code + shortLabel. No SIP/WSS/Kamailio/PBX terms. Technical detail logged to `console.debug` only.

**Admin page added:** `GET /diagnostics/errors` on push-server (WireGuard-only). Shows full technical catalog: long descriptions, likely layers, causes, checks. Accessible at `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/diagnostics/errors`.

**Shared catalog:** `regDiagCatalog.js` (ES module, frontend) + `diagCatalog.js` (CommonJS, push-server) mirror the same 10 error entries. Keep in sync when codes change.

**Kamailio KAM codes** (KAM-001 through KAM-006, KAM-E001 through KAM-E004) documented as "recommended next" in `docs/10-registration-diagnostics-and-error-codes.md` — no Kamailio config changes made.

---

## Recently completed work (continued)

### 2026-03-28 — Kamailio KAM server-side registration tracing

Added structured xlog tracing to Kamailio covering every step of the REGISTER flow. Enables LTE failure triage from server logs without browser access.

**Changes made:**
- `kamailio/kamailio.cfg` — KAM-001 / KAM-E001 in `event_route[xhttp:request]`: wrapped `ws_handle_handshake()` return; logs real client IP via `$hdr(X-Real-IP)` (set by Nginx on `/ws`)
- `kamailio/routes/20-registration.cfg` — KAM-002/005 at top of `HANDLE_REGISTER` (Authorization header presence distinguishes initial vs auth re-send); KAM-E002 in "no PBX host" block; KAM-003 before `route(RELAY)`; `t_on_failure("REGISTER_RELAY_FAILED")` added; new `failure_route[REGISTER_RELAY_FAILED]` → KAM-E003
- `kamailio/routes/40-replies.cfg` — KAM-004/006/KAM-E004 block at top of `onreply_route[MANAGE_REPLY]` gated on `$rm == "REGISTER"`
- `docs/07-phase-kamailio-rtpengine-nginx.md` — full KAM tracing section added: step/error code tables, log format, grep commands, LTE failure patterns

**Step codes implemented:** KAM-001 (WS accepted), KAM-002 (REGISTER received), KAM-003 (forwarded to PBX), KAM-004 (401 challenge), KAM-005 (auth REGISTER forwarded), KAM-006 (200 OK)

**Error codes implemented:** KAM-E001 (WS upgrade failed), KAM-E002 (no PBX host), KAM-E003 (relay failed / branch timeout), KAM-E004 (PBX returned 4xx/5xx)

**Log fields:** `ext=`, `domain=`, `src=`, `realip=` (KAM-001 only), `pbx=`, `ci=`, `status=`/`reason=` (error codes)

**Grep:**
```bash
docker logs -f kamailio 2>&1 | grep '\[KAM-'
docker logs kamailio 2>&1 | grep '\[KAM-E'
```

---

## Recently completed work (continued)

### 2026-03-28 — LTE media relay fix + admin routing config page

#### Part A: LTE media relay path

**Root cause:** On LTE with relay-only ICE, the browser only offers TURN relay candidates. RTPEngine must send media to the TURN relay address. If RTPEngine's SDP advertises a private/container IP instead of the public IP, CoTURN cannot route packets back and media fails.

**Changes made:**
- `kamailio/routes/60-media.cfg` — added `media-address=$env(KAM_PUBLIC_IP)` to both `ICE=force` rtpengine calls (PBX→WebRTC offer and PBX→WebRTC answer). Ensures RTPEngine always advertises the correct public IP in ICE candidates sent to the browser. Wi-Fi path unchanged (no `media-address` added to `ICE=remove` paths).
- `www/app/pc/bind.js` — added relay candidate type counter (`host`/`srflx`/`relay`/`prflx`); logs summary at ICE gathering complete; detects and logs relay-only mode at ICE connected; logs failure with candidate counts; logs "LTE relay-only mode confirmed" when relay is the only type.
- `www/app/registration/primary.js` — added explicit `ICE transport policy = relay — LTE/5G media relay mode ACTIVE` log at UA build time when LTE mode is enabled.

**LTE isolation:** relay mode is only active when the user has enabled "LTE/5G Mode" toggle. `iceTransportPolicy` is set in `buildUserAgent()` — `relay` when `isMobileCompatModeEnabled()`, `"all"` otherwise. Wi-Fi users are unaffected.

#### Part B: Admin routing config page

**New admin page:** `GET /admin/routing` — WireGuard-only, same guard as dashboard.

Shows: currently loaded PBX mappings and trusted IPs (read-only, from process.env). Allows editing and saving to `routing-config.json`.

**Save/apply flow:**
1. Admin page saves to `routing-config.json` (file mounted in push-server container)
2. "Save" does NOT auto-apply to Kamailio
3. To apply: `make routing-apply` on host → reads routing-config.json, updates `.env` PBX_MAP_* and TRUSTED_SIP_* entries, runs `make render`
4. Then: `docker compose restart kamailio`

**Changes made:**
- `push-server/src/services/routingConfig.js` — NEW: read/write routing-config.json; read current env; validate input
- `push-server/src/routes/adminRoutes.js` — NEW: `GET /admin/routing` (HTML), `GET /admin/routing/config` (JSON), `POST /admin/routing/config` (save)
- `push-server/src/admin/routingPage.js` — NEW: HTML page with editable PBX mappings, trusted IPs, trusted domains; shows current env side-by-side; apply instructions
- `push-server/server.js` — mounted `createAdminRoutes` at `/admin`; added routing URL to admin listener startup log
- `docker-compose.yml` — added `./routing-config.json:/app/routing-config.json` volume to push-server
- `routing-config.json` — NEW: initial empty config file on host
- `scripts/apply-routing-config.py` — NEW: reads routing-config.json, updates .env managed keys (PBX_MAP_1..8, TRUSTED_SIP_IP_1..8, TRUSTED_SIP_DOMAIN_1..8), preserves all other .env entries
- `Makefile` — added `routing-apply` target (calls apply script + make render; prints restart instructions)

**New admin URL:** `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/routing`

---

## Recently completed work (continued)

### 2026-03-28 — LTE media diagnostics: relay guard + server-visible call log

**Root cause confirmed:** On LTE with relay-only ICE, if TURN is unreachable, the browser gathers zero candidates and sends SDP with `c=0.0.0.0 m=audio 9`. RTPEngine stores this as the browser endpoint, DTLS never completes → "SRTP output wanted, but no crypto suite was negotiated."

**Changes made:**

- `www/app/features/lteCallGuard.js` — NEW: ICE relay readiness guard + MEDIA error catalog (MEDIA-E001..E004). `guardLteRelayReadiness()` watches ICE gathering after invite/accept; fires `onFail(code, userMessage)` if relay=0 or timeout; cancels session and shows user-safe message. Wi-Fi path completely unaffected.
- `www/app/features/callMediaLog.js` — NEW (created this session): client-side event batcher → `POST /api/logs/call`; max 5/batch, 30 queue, 4s timeout, silent failure.
- `www/app/pc/bind.js` — added `sendCallMediaEvent` on ICE gathering complete (with candidate counts) and ICE failed.
- `www/app/registration/primary.js` — added `ua-ice-policy` event to callMediaLog on UA build.
- `www/app/outgoing/call.js` — wired `guardLteRelayReadiness` and `call-start` event after `invite()`.
- `www/app/incoming/handlers.js` — wired `guardLteRelayReadiness` and `call-answer` event after `accept()`.
- `push-server/src/services/callLogStore.js` — NEW: in-memory ring buffer (max 500 events) with filter/query helpers.
- `push-server/src/routes/logRoutes.js` — added `POST /api/logs/call` endpoint (public, no auth; sanitizes input; rejects batch >20).
- `push-server/src/admin/callLogPage.js` — NEW: admin HTML page with filter controls and event table.
- `push-server/src/routes/adminRoutes.js` — added `GET /admin/calllogs` (HTML) and `GET /admin/calllogs/json` (JSON API).
- `push-server/server.js` — added call logs URL to admin startup log.

**New admin URL:** `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/calllogs`

**MEDIA error codes:**
- MEDIA-E001: Relay not found (zero relay candidates in LTE mode)
- MEDIA-E002: ICE timeout (gathering timed out)
- MEDIA-E003: Secure media failed (DTLS/SRTP; server-side only, not yet client-reported)
- MEDIA-E004: No audio received (zero RTP; server-side only, not yet client-reported)

**Container restart required:** `docker compose restart push-server` (new routes + callLogStore)

---

## Recently completed work (continued)

### 2026-03-29 — LTE media fix: pre-flight TURN check + SDP-based ICE counting

**Problem discovered:** Admin calllogs showed zero events. Root cause traced to SIP.js 0.21 non-trickle ICE: gathering completes BEFORE `invite()` returns. The post-invite guard was attaching after all `icecandidate` events already fired, reading zero counts → false MEDIA-E001 on every LTE call. Also, `bindPeerConnection` in `pc/bind.js` is called from a session state-change listener (Establishing), which also fires after gathering — all ICE events missed there too.

**Root cause chain:**
1. LTE/5G Mode ON → `iceTransportPolicy: "relay"` → only TURN relay candidates gathered
2. LTE carrier blocks UDP/TCP 3478 and TLS 5349 → TURN unreachable → zero candidates
3. SIP.js non-trickle: ICE gathering complete BEFORE `invite()` returns
4. Previous post-invite guard attached too late → read zero counts from already-complete gathering
5. Bad SDP `c=0.0.0.0 m=audio 9` sent to PBX → RTPEngine never gets a real media endpoint → no audio

**Changes made:**
- `www/app/features/lteCallGuard.js` — REWRITTEN: added `checkLteRelayAvailable()` pre-flight (temp `RTCPeerConnection` + data channel, relay-only policy, test gather before invite); added `countCandidatesFromSdp()` for SDP-based candidate counting; fixed `waitForIceGatheringComplete()` to read SDP when gathering already complete
- `www/app/outgoing/call.js` — pre-flight TURN check runs BEFORE `new SIP.Inviter()` / `invite()`; aborts with user message if relay=0; fixed `onOutboundStateChange` to pass `{aor, callId}` to `bindPeerConnection`
- `www/app/incoming/handlers.js` — pre-flight TURN check runs BEFORE `invitation.accept()`; rejects with 488 if relay=0
- `www/app/pc/bind.js` — reads candidates from `pc.localDescription.sdp` via `countCandidatesFromSdp()` when `iceGatheringState === 'complete'` at bind time; `ice-complete` server events always have accurate counts
- `www/index.html.template` — bumped `v=1773032001` → `v=1773032002` to force JS module reload
- `docker-compose.yml` — added `--verbose` to CoTURN command for TURN allocation logging

**Effect:** If TURN is unreachable, the pre-flight check catches it before any INVITE is sent. User sees "Could not reach the media relay" immediately. No `0.0.0.0:9` SDP ever reaches RTPEngine.

**Commands to run after this session:**
```bash
make render
docker compose up -d --build push-server
docker compose up -d --force-recreate coturn
# Then hard-refresh browser (Ctrl+Shift+R)
```

---

## Recently completed work (continued)

### 2026-03-29 — Wi-Fi media regression fix

**Regression:** Wi-Fi→Wi-Fi calls developed asymmetric audio (caller hears callee, callee cannot hear caller) after the LTE media work session.

**Root cause:** `kamailio/routes/60-media.cfg` had uncommitted working-tree changes adding `media-address=$env(KAM_PUBLIC_IP)` to both PBX→WebRTC paths (MEDIA_OFFER `else` and MEDIA_ANSWER `else` branches). Kamailio was restarted 12 minutes after the file was modified, so it was running the broken config. The `media-address` flag in these shared paths caused the asymmetric audio — mechanism not fully understood, but likely an interaction with `DTLS=passive` + `rtcp-mux` in this RTPEngine version.

**Key finding:** RTPEngine is already configured with `--interface=eth0!${PUBLIC_IP}` in docker-compose.yml, which makes it advertise the correct public IP in ICE candidates without any per-call override. The `media-address` flag was redundant and harmful.

**Fix:** Removed `media-address` concatenation from both PBX→WebRTC `else` branches in `60-media.cfg`. Restored to committed state. Added comments documenting why `media-address` must NOT be added to those paths.

**Changed file:** `kamailio/routes/60-media.cfg` only.

**Container restart required:** `docker compose restart kamailio`

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
TURN_HOST = "${DOMAIN}"
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
`www/index.html`, `kamailio/local.cfg`, `coturn/turnserver.conf`, `rtpengine/rtpengine.conf`, `nginx/site.conf` — all generated by `make`. Edit `.template` versions. Detail: [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md).

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
