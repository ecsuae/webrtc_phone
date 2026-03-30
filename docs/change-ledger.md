# Change Ledger

_This is a live, rotating ledger of every meaningful change made to this repo._

## Rules (mandatory)

- Update this file **before ending every AI session**.
- **Append-only:** do not overwrite history. Add new entries without deleting prior real entries.
- **Consistent ordering:** append new entries either at the top or the bottom consistently. This file uses **newest-first** under “Current week entries”.
- **Corrections:** never rewrite prior real entries except to correct factual mistakes. If you correct an entry, add a new timestamped note describing what was corrected.
- Every entry MUST include:
  - timestamp
  - AI signature/name (Claude / Windsurf / ChatGPT / other)
  - exact files changed
  - restart required (exact service(s) + command if known) or **no restart required**
  - exact verified result (what you actually confirmed)
  - next safe step
- **Do not let this file grow forever.**
  - When this file reaches ~400 lines, rotate/archive it.
  - Archive weekly using week-range filenames like:
    - `2026-03-23_to_2026-03-29_change-ledger.md`
  - Put archived files in the correct month folder under:
    - `Work_Flow/2026/03-Mar/`
  - Keep only the current live file in `docs/`.
  - After rotation, create a fresh trimmed live file in `docs/` containing only the current essential state.

---

## Current week entries

### 2026-03-30T02:30:00Z — Android auto-login after hard refresh: remove pinned `?v=` module chain, enforce runtime `cb` graph
- **AI**: Cascade (Windsurf)
- **Scope**: Frontend module graph/versioning only (Android boot path); no SIP/media behavior changes
- **Root cause (proven)**:
  - Android was executing a stale pinned ES module chain because platform boot and Android call flow imported fixed `?v=...` modules.
  - Evidence from Android stack traces during unwanted auto-login:
    - `startAndRegister` -> `runOneTapEnableFlow` -> `controlBindings.js?v=...`
  - Specific pinned sources:
    - `www/app/main.js` imported `./runtime/android/bootstrapAndroid.js?v=1773033002`
    - `www/app/runtime/android/callFlowAndroid.js` imported `../controlBindings.js?v=1773032001`
- **Fix (final)**:
  - Converted platform boot to runtime `cb`-tokenized dynamic imports so Android cannot fall back to stale `?v=` graphs.
  - Removed remaining fixed `?v=` imports inside Android bootstrap.
  - Android now consistently loads:
    - `bootstrapAndroid.js?cb=<token>`
    - `callFlowAndroid.js?cb=<token>`
    - `controlBindings.js?cb=<token>`
- **Files changed**:
  - `www/app/main.js`
  - `www/app/runtime/android/bootstrapAndroid.js`
  - `www/app/runtime/android/callFlowAndroid.js`
- **Restart required**:
  - phone-nginx: redeploy updated `www/` static assets and reload/recreate nginx if your deploy does not live-update the docroot
  - client: close/reopen app/tab recommended for clean verification
- **Verified result**:
  - Android Chrome/Google browser no longer auto-registers after hard refresh.
  - Password entry does not trigger registration.
  - Only **Enable Calls** triggers first registration.
  - Android DevTools shows no `bootstrapAndroid.js?v=...` and no `controlBindings.js?v=...` (only `?cb=`).
- **Next safe step**:
  - Keep `?v=` usage out of the runtime module graph; if you must version, use the `cb` propagation pattern end-to-end.

### 2026-03-29T18:30:00Z — Frontend cache self-heal + restore manual Enable Calls login trigger
- **AI**: Cascade (Windsurf)
- **Scope**: Frontend cache/versioning + UI login trigger behavior only (no SIP/media feature changes)
- **Symptoms**:
  - Android/PWA could boot into stale cached JS module graphs after deploy (ES module export mismatch crashes).
  - Regression: entering username/password could auto-start registration instead of waiting for **Enable Calls**.
- **Causes**:
  - Stale HTML shell/SW/cache could pin an older module graph even after a deploy.
  - `runtime/controlBindings.js` triggered `runOneTapEnableFlow()` on password Enter key, and recovery paths could trigger registration without explicit user intent.
- **Fix**:
  - Added deploy build stamping (`FRONTEND_BUILD`) + startup build handshake in `www/index.html(.template)` to auto-detect mismatched builds and self-heal (unregister SW, clear caches, clear safe storage, reload with new token).
  - Fixed render pipeline to avoid `${...}` sequences from JS template literals tripping the `make render` unresolved-variable guard.
  - Restored manual registration trigger: only **Enable Calls** initiates registration.
  - Gated mobile/SW wake recovery registration behind explicit user intent (`webrtc_calls_enabled`).
- **Files changed**:
  - `Makefile`
  - `www/index.html`
  - `www/index.html.template`
  - `nginx/phone.srve.cc.conf`
  - `nginx/phone.srve.cc.conf.template`
  - `www/app/runtime/controlBindings.js`
  - `www/app/runtime/registerFlow.js`
  - `www/app/runtime/mobileRecovery.js`
  - `www/app/runtime/swWakeHandler.js`
  - `www/app/sipRegister.js`
  - `www/app/incoming/handlers.js`
  - `www/app/outgoing/call.js`
  - `docs/hard-refresh-self-heal.md`
- **Restart required**:
  - phone-nginx: redeploy static assets + recreate/reload nginx so cache headers + new HTML shell are live
  - browser: no manual cache clearing required; clients should self-heal on next open
- **Verified result**:
  - `make render` succeeds with the unresolved-variable guard intact.
- **Next safe step**:
  - Deploy updated `www/` assets, recreate `phone-nginx`, then on Android verify:
    - build indicator shows `running==latest`
    - entering credentials does not auto-register
    - only **Enable Calls** triggers registration

### 2026-03-29T17:35:00Z — Android frontend boot: fix PC stats import error + add SW/build-id probes
- **AI**: Cascade (Windsurf)
- **Scope**: Frontend module graph + SW/cache observability (no SIP/media behavior changes)
- **Symptom**:
  - Android DevTools: `SyntaxError: The requested module './stats.js' does not provide an export named 'scheduleMediaStatsSnapshots' (at bind.js:4:27)`
- **Cause**:
  - The live client was loading a stale/cached `./stats.js` without the `scheduleMediaStatsSnapshots` export while `bind.js` expected it.
  - This prevents the JS module graph from completing bootstrap, which cascades into remote logging/metadata probes not running.
- **Fix**:
  - `www/app/pc/bind.js`: import `./stats.js` using the same version query param convention as the rest of the app: `./stats.js?v=1773033002`.
  - `www/sw.js`: ensure navigation documents are always fetched with `no-store` to avoid pinning an older HTML shell/module graph on Android/PWA; bump `SW_VERSION`.
  - Added boot-time probes to prove which module URLs are executing and whether SW controls the page:
    - `SW_CONTROLLED`, `BOOT_BUILD_ID`, `REMOTELOGS_BUILD_ID`, `SW_UNREGISTER_OK`, `CACHE_CLEAR_OK`.
- **Files changed**:
  - `www/app/pc/bind.js`
  - `www/sw.js`
  - `www/app/page/bootstrapPage.js`
  - `www/app/page/cacheActions.js`
  - `www/app/remoteLogs/service.js`
- **Deploy note**:
  - Redeploy the static web assets under nginx docroot (`/var/www/phone`).
  - On Android, use the in-app cache clear and/or clear site data to ensure the new module URLs load.

### 2026-03-29T16:55:00Z — Mobile debug logs: fix nginx body-size rejection + add server proof markers for log ingest
- **AI**: Cascade (Windsurf)
- **Scope**: Mobile debug-log pipeline only (no SIP/media/registration changes)
- **Root cause**:
  - Metadata uploads succeed (`POST /api/logs/mobile/metadata`) because they are small.
  - Debug log uploads (`POST /api/logs/mobile`) can be multi-megabyte; nginx defaults can reject large bodies before proxying to push-server, resulting in: device cards present (metadata), but no log files on disk and no push-server log ingest activity.
- **Files changed**:
  - `nginx/phone.srve.cc.conf`
  - `nginx/phone.srve.cc.conf.template`
  - `push-server/src/routes/logRoutes.js`
- **Restart required**:
  - phone-nginx: reload/recreate so `client_max_body_size` is active
  - push-server: rebuild/recreate container so proof markers are active
- **Verified result** (code-level):
  - nginx now allows up to `25m` request bodies under `location /api/`.
  - push-server now logs `[DEBUG_LOG_ROUTE_HIT]` and `[DEBUG_LOG_FILE_WRITE_OK/FAILED]` for `POST /api/logs/mobile` to prove whether log uploads reach storage.
- **Next safe step**:
  - Recreate phone-nginx + push-server, enable Debug Mode on Android, generate logs, then check:
    - `docker logs push-server --tail=200` includes `[DEBUG_LOG_ROUTE_HIT]`
    - `backups/mobile-logs/<deviceId>/latest.json` and `batch_*.json` exist

### 2026-03-29T16:40:00Z — Mobile debug logs: fix upload acceptance + improve dashboard ordering + log visibility
- **AI**: Cascade (Windsurf)
- **Scope**: Mobile debug log pipeline + dashboard UX only (no SIP/media/call behavior changes)
- **Root cause**:
  - Debug metadata POSTs are small and were succeeding, so devices appeared on the dashboard.
  - Debug log POST bodies can become multi-megabyte (aggregated batches); the server was using default `bodyParser.json()` limits, causing large `/api/logs/mobile` uploads to be rejected (typical symptom: HTTP 413 / request entity too large).
  - Dashboard ordering did not enforce online-first, and the device cards did not clearly show whether logs existed / last log time.
- **Files changed**:
  - `push-server/server.js`
  - `push-server/src/routes/logRoutes.js`
  - `push-server/src/dashboard/dashboard.js`
- **Restart required**:
  - push-server: rebuild/recreate container so server.js + routes are live
- **Verified result** (code-level):
  - Server now accepts larger JSON bodies (`25mb`) so debug log uploads are not rejected while metadata still works.
  - `/api/logs/mobile` now returns `latestLogTimestamp` + `hasLatestTail` so the dashboard can show log status without reading giant files.
  - Dashboard now sorts: online first, then newest; offline after, then newest.
- **Next safe step**:
  - Recreate push-server container, enable Debug Mode on Android, generate logs, and confirm:
    - device card shows `Logs: available (tail)` and a recent `Last log` timestamp
    - "View Latest Logs" loads quickly and shows fresh lines

### 2026-03-29T16:20:00Z — Mobile debug logs: fix dashboard 'View Latest Logs' for large aggregated debug batches
- **AI**: Cascade (Windsurf)
- **Scope**: Mobile debug log pipeline (dashboard latest-log retrieval) only — no SIP/media/registration behavior changes
- **Root cause**:
  - Some Android devices upload logs into an aggregated debug batch file (e.g. `batch_debug.json`) that can grow very large (10+ MB).
  - The dashboard button "View Latest Logs" calls `GET /api/logs/mobile/:deviceId/latest`, which read+`JSON.parse`d the *entire* latest file.
  - On large debug batch files, this makes the endpoint slow/unreliable and causes the dashboard modal to appear empty / show no useful logs.
- **Files changed**:
  - `push-server/src/routes/logRoutes.js`
- **Restart required**:
  - push-server: restart/recreate so the updated route is live
- **Verified result**:
  - Code-level fix: server now writes a small `latest.json` tail file (last ~400 logs) on each aggregated upload, and `/api/logs/mobile/:deviceId/latest` prefers that file when present.
- **Next safe step**:
  - Restart push-server, then on Android toggle Debug Mode ON and generate a few logs; confirm the device card's "View Latest Logs" shows fresh lines quickly.

### 2026-03-29T04:00:00Z — Call logs page: PROBLEM highlighting, remove hardcoded buttons + auto-refresh, missing-leg detection
- **AI**: Claude (Sonnet 4.6)
- **Scope**: Admin call logs page usability only (observability-only; no call/media/SIP/LTE/TURN behavior changes)
- **Files changed**:
  - `push-server/src/admin/callLogPage.js`
- **Restart required**:
  - push-server: `docker compose up -d --force-recreate push-server`
- **Verified result**:
  - Removed hardcoded 900900/600600 quick-filter nav links entirely
  - Removed auto-refresh (was: 15s reload when no filter active) — page now stays stable while reading
  - Added `.problem-row` (dark red bg, red stage label) and `.warn-row` (amber bg) CSS classes
  - PROBLEM row types now show descriptive stage labels: "PROBLEM: one-way audio", "PROBLEM: missing leg", "PROBLEM: LTE no receive"
  - Warn row types: "No inbound RTP", "No outbound RTP", "DTLS ok / no RTP", "Audio play failed", "ICE mismatch"
  - Missing-leg detection: `incomplete-observability` PROBLEM row is now injected for ALL calls with only one leg present (was: only when one-way audio was also confirmed)
  - Stats rows with zero RTP show inline `recv: 0` / `sent: 0` in red in the message cell
  - Raw view and per-call trace: unchanged
- **Next safe step**:
  - Restart push-server and confirm at `/admin/calllogs`

### 2026-03-29T03:10:00Z — Admin call logs usability: Summary vs Raw, dedupe, ICE error aggregation, identity normalization
- **AI**: Cascade (Windsurf)
- **Scope**: Admin log usability only (observability-only; no call/media/SIP/LTE/TURN behavior changes)
- **Files changed**:
  - `push-server/src/services/callLogStore.js`
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/admin/callLogPage.js`
  - `docs/current-task-status.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - push-server: `docker compose up -d --force-recreate push-server`
- **Verified result**:
  - `/admin/calllogs` defaults to **Summary** view and provides a Summary/Raw toggle; per-call trace defaults to **Raw**.
  - Summary view hides/collapses noisy duplicates and aggregates repeated `*-preflight-icecandidateerror` into a single `... xN` row per short window.
  - Malformed stored AOR values like `user@domain@domain` are normalized to `user@domain` at ingest.
- **Next safe step**:
  - Compare Summary vs Raw for one outbound LTE call and confirm trace shows the complete raw timeline:
    - Summary: `/admin/calllogs?username=900900&dir=outbound&profile=lte`
    - Raw: `/admin/calllogs?username=900900&dir=outbound&profile=lte&view=raw`

### 2026-03-29T03:00:00Z — TZ follow-up: fix push-server + kamailio local time (PKT) via zoneinfo mount
- **AI**: Cascade (Windsurf)
- **Scope**: Container timezone handling only for push-server/kamailio (no media/call behavior changes)
- **Files changed**:
  - `docker-compose.yml`
- **Restart required**:
  - `docker compose up -d push-server kamailio` (recreate containers)
- **Verified result**:
  - Root cause: push-server (alpine) lacked `tzdata` and both images lacked usable `Asia/Karachi` zoneinfo; additionally host `/etc/timezone` was `Europe/Berlin`, so mounting it prevented correct TZ reporting
  - Fix: mount host `/usr/share/zoneinfo` into push-server + kamailio and rely on `TZ=Asia/Karachi` (no `/etc/timezone` mount)
  - Verified: `docker exec push-server date` and `docker exec kamailio date` now show PKT local time
- **Next safe step**:
  - Verify again:
    - `docker exec push-server sh -lc 'date; echo "TZ=$TZ"; cat /etc/timezone 2>/dev/null || true; readlink -f /etc/localtime || true'`
    - `docker exec kamailio sh -lc 'date; echo "TZ=$TZ"; cat /etc/timezone 2>/dev/null || true; readlink -f /etc/localtime || true'`

### 2026-03-29T02:50:00Z — Admin logs: display timestamps in Asia/Karachi (PKT) + standardize container TZ
- **AI**: Cascade (Windsurf)
- **Scope**: Admin/log timezone handling only (no media/call behavior changes)
- **Files changed**:
  - `push-server/src/admin/callLogPage.js`
  - `docker-compose.yml`
- **Restart required**:
  - `docker compose up -d` (to recreate containers with new `TZ` env)
- **Verified result**:
  - Confirmed root cause of ~5 hour skew: ISO timestamps (UTC) were rendered directly in admin UI
  - Admin UI now formats timestamps for `Asia/Karachi` and shows `PKT` label while keeping canonical UTC stored
  - Confirmed containers were running in UTC; added `TZ=Asia/Karachi` to compose for push-server/kamailio/rtpengine/coturn/phone-nginx
- **Next safe step**:
  - Recreate services and verify:
    - `docker exec push-server date`
    - `docker exec kamailio date`
    - `docker exec rtpengine date`
    - `docker exec coturn date`
    - `docker exec phone-nginx date`

### 2026-03-29T02:20:00Z — Observability: outbound caller-side (900900) call logs + POST failure surfacing
- **AI**: Cascade (Windsurf)
- **Scope**: Observability only — improve LTE caller-side outbound events and admin filtering (no media/SIP/LTE/TURN behavior changes)
- **Files changed**:
  - `www/app/features/callMediaLog.js`
  - `www/app/outgoing/call.js`
  - `www/app/features/lteCallGuard.js`
  - `www/app/pc/bind.js`
  - `push-server/src/services/callLogStore.js`
  - `push-server/src/admin/callLogPage.js`
- **Restart required**:
  - push-server: yes
  - Browser hard refresh: recommended
- **Verified result**:
  - Added explicit `outbound-*` caller-side events for LTE preflight/invite/remote audio
  - Added `call-log-post-failed` reporting (HTTP status / fetch failure) to detect when caller-side POSTs fail
  - Call Logs admin page includes quick filter links for `900900` outbound and `600600` inbound views
- **Next safe step**:
  - Restart push-server and hard refresh webphone, then place one LTE outbound call from `900900` and filter `/admin/calllogs?username=900900&dir=outbound&profile=lte`

### 2026-03-29T02:10:00Z — UI: add dashboard/admin navigation links
- **AI**: Cascade (Windsurf)
- **Scope**: UI/navigation only — expose existing admin routes via visible links (no call/media/SIP/LTE/TURN/logging behavior changes)
- **Files changed**:
  - `push-server/dashboard.html`
  - `push-server/src/dashboard/styles.css`
  - `push-server/src/admin/callLogPage.js`
  - `push-server/src/admin/routingPage.js`
- **Restart required**:
  - push-server: yes
- **Verified result**:
  - Dashboard now includes direct links to: `/dashboard`, `/diagnostics/errors`, `/admin/routing`, `/admin/calllogs`
  - Routing + Call Logs pages include complete cross-links between these existing admin pages
- **Next safe step**:
  - Restart push-server and verify links render correctly on WireGuard admin listener

### 2026-03-29T02:05:00Z — Fix: ensure runtime APP_CONFIG/TURN config is loaded (LTE relay preflight)
- **AI**: Cascade (Windsurf)
- **Scope**: LTE-only diagnosis + minimal page wiring fix (no Wi-Fi media behavior changes)
- **Files changed**:
  - `www/index.html`
  - `www/index.html.template`
- **Restart required**:
  - If static assets are served from disk/container: restart the web server container serving `/www` or redeploy the updated assets.
  - Browser: hard refresh required.
- **Verified result**:
  - Code-level root cause identified and corrected: `/config.js` (which defines `window.APP_CONFIG` from `data-turn-*`) was not loaded by the page, preventing TURN entries from being included in `ICE_SERVERS` and causing relay-only LTE preflight to yield zero candidates.
- **Next safe step**:
  - After redeploy/restart + hard refresh, confirm in browser console:
    - `window.APP_CONFIG.TURN_HOST`, `TURN_USER`, `TURN_PASS` are non-empty
    - `ICE_SERVERS` includes `turn:` and `turns:` URLs
  - Run one LTE → LTE test and capture CoTURN logs during the attempt.

### 2026-03-29T00:00:00Z — Workflow/handoff system created
- **AI**: Cascade (Windsurf)
- **Scope**: Documentation/workflow only (no media/call behavior changes)
- **Files changed**:
  - `docs/current-task-status.md`
- **Files created**:
  - `docs/change-ledger.md`
  - `docs/current-ai-handoff.md`
  - `docs/known-good-baseline.md`
- **Folders created**:
  - `Work_Flow/2026/01-Jan/` through `Work_Flow/2026/12-Dec/`
- **Restart required**:
  - No
- **Verified result**:
  - Workflow docs exist under `docs/`
  - `Work_Flow/2026/<month>` structure exists
- **Next safe step**:
  - Each AI session must update: `docs/current-task-status.md`, `docs/change-ledger.md`, `docs/current-ai-handoff.md` (and `docs/known-good-baseline.md` only if baseline changed)
