# Current Task Status
_Last updated: 2026-03-29_

---

## AI Update Block (required)

**Append-only rule:** Do not overwrite history. Append new timestamped update blocks and preserve prior real entries unless rotating.

- **Timestamp**: 2026-03-29T00:00:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Observability + admin log usability only (no media/call routing changes)
- **Files changed**:
  - (see `docs/change-ledger.md`)
- **Restart required**:
  - push-server: yes (if server files changed)
  - browser: hard refresh recommended (if frontend files changed)
- **Verified result**:
  - Admin call logs page supports richer filters + per-call trace and accepts richer structured events
- **Next safe step**:
  - Test LTE → Wi-Fi and LTE → LTE after confirming Wi-Fi baseline (update baseline doc only for paths actually verified)

- **Timestamp**: 2026-03-29T16:20:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Mobile debug log pipeline only (Android-focused symptom: dashboard shows device card but “View Latest Logs” appears empty)
- **Files changed**:
  - `push-server/src/routes/logRoutes.js`
  - `docs/change-ledger.md`
- **Restart required**:
  - push-server: yes (restart/recreate container)
  - browser: no (dashboard is server-rendered/served), but reload dashboard page after server restart
- **Verified result** (code-level):
  - Root cause identified: aggregated debug log files (e.g. `batch_debug.json`) can grow very large and make `/api/logs/mobile/:deviceId/latest` too slow/unreliable when it reads+parses the entire file.
  - Fix implemented: server now maintains a small `latest.json` tail file (last ~400 logs) for aggregated uploads and the “latest” endpoint prefers it.
- **Next safe step**:
  - Restart push-server.
  - On Android: toggle Debug Mode ON, generate a few logs, wait up to 60s, then confirm the dashboard “View Latest Logs” shows fresh lines quickly.

- **Timestamp**: 2026-03-29T16:40:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Mobile debug-log pipeline + dashboard ordering (Android-focused symptom: devices visible but debug logs not showing reliably)
- **Files changed**:
  - `push-server/server.js`
  - `push-server/src/routes/logRoutes.js`
  - `push-server/src/dashboard/dashboard.js`
  - `docs/change-ledger.md`
- **Restart required**:
  - push-server: yes (rebuild/recreate container)
  - browser: reload `/dashboard` after server restart
- **Verified result** (code-level):
  - Root cause addressed: server now accepts large JSON log uploads (debug batches) by raising JSON body size limit.
  - Dashboard now sorts online-first, newest-first within each group.
  - Device cards now show `Logs: empty/available` plus `Last log` timestamp sourced from `/api/logs/mobile` without reading giant log files.
- **Next safe step**:
  - Recreate push-server container.
  - On Android: enable Debug Mode, generate logs, wait ~45s, then confirm dashboard shows a recent `Last log` time and “View Latest Logs” returns fresh entries.

- **Timestamp**: 2026-03-29T02:05:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: LTE-only investigation + minimal runtime config wiring fix (no Wi-Fi media behavior changes)
- **Files changed**:
  - `www/index.html`
  - `www/index.html.template`
- **Restart required**:
  - If `www/index.html` is served from disk by a container/static server: restart the web server container serving `/www` OR redeploy the updated static assets.
  - Browser: hard refresh required (cache bypass) to ensure `/config.js` is loaded.
- **Verified result**:
  - Code-level root cause identified: `window.APP_CONFIG` is defined by `/config.js` (generated from `www/config.js`), but `www/index.html` / `www/index.html.template` did not load `/config.js`.
  - This prevents TURN creds from reaching runtime config, which in turn prevents TURN entries from being added to `ICE_SERVERS` (STUN-only runtime), making LTE relay-only preflight produce zero relay candidates.
- **Next safe step**:
  - After redeploy/restart + hard refresh:
    - In browser devtools console, confirm `window.APP_CONFIG` has non-empty `TURN_HOST`, `TURN_USER`, `TURN_PASS`.
    - Confirm `ICE_SERVERS` includes `turn:` / `turns:` urls (not STUN-only).
    - Run one LTE → LTE attempt and capture CoTURN logs during the attempt.

- **Timestamp**: 2026-03-29T02:10:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: UI/navigation only — expose existing admin routes via visible links (no call/media/SIP/LTE/TURN/logging behavior changes)
- **Files changed**:
  - `push-server/dashboard.html`
  - `push-server/src/dashboard/styles.css`
  - `push-server/src/admin/callLogPage.js`
  - `push-server/src/admin/routingPage.js`
- **Restart required**:
  - push-server: yes
- **Verified result**:
  - Dashboard now shows direct links to: `/dashboard`, `/diagnostics/errors`, `/admin/routing`, `/admin/calllogs`
  - Routing + Call Logs pages include complete cross-links between these existing admin pages
- **Next safe step**:
  - Restart push-server and confirm links are visible/working on WireGuard admin listener

- **Timestamp**: 2026-03-29T02:20:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Observability only — improve outbound caller-side (900900) admin call logs (no media/SIP/LTE/TURN behavior changes)
- **Files changed**:
  - `www/app/features/callMediaLog.js`
  - `www/app/outgoing/call.js`
  - `www/app/features/lteCallGuard.js`
  - `www/app/pc/bind.js`
  - `push-server/src/services/callLogStore.js`
  - `push-server/src/admin/callLogPage.js`
- **Restart required**:
  - push-server: yes
  - browser: hard refresh recommended
- **Verified result**:
  - Outbound LTE caller-side now emits explicit `outbound-*` preflight/invite/remote-audio events with consistent identity fields where available
  - Call log transport failures are surfaced via `call-log-post-failed` (reported on next successful POST)
  - Call Logs admin page includes quick filter links for `900900` outbound and `600600` inbound views
- **Next safe step**:
  - Restart push-server, hard refresh the webphone, then run one LTE outbound call from `900900` and filter `/admin/calllogs?username=900900&dir=outbound&profile=lte`

- **Timestamp**: 2026-03-29T02:50:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Admin log timezone standardization only (no media/call behavior changes)
- **Files changed**:
  - `push-server/src/admin/callLogPage.js`
  - `docker-compose.yml`
- **Restart required**:
  - push-server: yes
  - phone-nginx: yes (compose env change)
  - kamailio: yes (compose env change)
  - rtpengine: yes (compose env change)
  - coturn: yes (compose env change)
- **Verified result**:
  - Root cause confirmed: admin UI rendered ISO timestamps as raw UTC (about 5 hours behind PKT)
  - UI now formats timestamps in `Asia/Karachi` and appends `PKT`, while preserving stored canonical UTC in `ev.ts` / `ev._serverTs`
  - Containers were confirmed running in UTC; compose now sets `TZ=Asia/Karachi` for key services for consistent log timestamps
- **Next safe step**:
  - Apply compose changes and verify per-container time:
    - `docker exec push-server date`
    - `docker exec kamailio date`
    - `docker exec rtpengine date`
    - `docker exec coturn date`
    - `docker exec phone-nginx date`

- **Timestamp**: 2026-03-29T03:00:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Container timezone fix for push-server + kamailio only (no media/call behavior changes)
- **Files changed**:
  - `docker-compose.yml`
- **Restart required**:
  - push-server: yes (recreate container)
  - kamailio: yes (recreate container)
- **Verified result**:
  - Root cause: images lacked tzdata/zoneinfo for `Asia/Karachi`; additionally host `/etc/timezone` contained `Europe/Berlin`, which prevented correct reporting when mounted
  - Fix: mount host `/usr/share/zoneinfo` into push-server + kamailio and rely on `TZ=Asia/Karachi` (no `/etc/timezone` mount)
  - Verified: `docker exec push-server date` and `docker exec kamailio date` now report PKT local time
- **Next safe step**:
  - Re-run verification:
    - `docker exec push-server sh -lc 'date; echo "TZ=$TZ"; cat /etc/timezone 2>/dev/null || true; readlink -f /etc/localtime || true'`
    - `docker exec kamailio sh -lc 'date; echo "TZ=$TZ"; cat /etc/timezone 2>/dev/null || true; readlink -f /etc/localtime || true'`

- **Timestamp**: 2026-03-29T04:00:00Z
- **AI**: Claude (Sonnet 4.6)
- **Session scope**: Call logs page usability overhaul — Summary/Raw cleanup, PROBLEM row highlighting, remove hardcoded extension buttons, disable auto-refresh (observability-only; no call/media behavior changes)
- **Files changed**:
  - `push-server/src/admin/callLogPage.js`
- **Restart required**:
  - push-server: `docker compose up -d --force-recreate push-server`
- **Verified result** (code-level):
  - Removed hardcoded 900900/600600 quick-filter nav links
  - Removed auto-refresh script (no more 15s page jump)
  - Added `.problem-row` (red) and `.warn-row` (yellow) CSS + applied to PROBLEM/RTP-zero event types
  - Stage labels are now descriptive: "PROBLEM: one-way audio", "PROBLEM: missing leg", "No inbound RTP", "DTLS ok / no RTP", etc.
  - Added injection of `incomplete-observability` row for ALL calls with only one leg present (not just when one-way audio is diagnosed)
  - Stats rows with zero inbound/outbound RTP show `recv: 0` / `sent: 0` in red inline in the message cell
  - Raw view and per-call trace remain exact stored timeline with no changes
- **Next safe step**:
  - Restart push-server and load `/admin/calllogs`
  - Confirm: no 900900/600600 buttons, no auto-jump, PROBLEM rows visually red, warn rows yellow

- **Timestamp**: 2026-03-29T03:10:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Admin call log usability cleanup only (observability-only; no call/media behavior changes)
- **Files changed**:
  - `push-server/src/services/callLogStore.js`
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/admin/callLogPage.js`
  - `docs/current-task-status.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - push-server: yes (rebuild/recreate container)
- **Verified result**:
  - `/admin/calllogs` now defaults to **Summary** view (deduplicated milestones) with a Summary/Raw toggle.
  - Per-call trace (`callId` scoped view) defaults to **Raw** full timeline.
  - Summary view collapses repeated `*-preflight-icecandidateerror` spam into a single `... xN` row per short window.
  - Summary view canonicalizes/filters duplicate event variants (e.g. `outbound-*` vs non-prefixed) to reduce noise while preserving raw events.
  - Ingest now normalizes malformed AOR values so `user@domain@domain` is stored as `user@domain`.
- **Next safe step**:
  - Place one outbound LTE call and compare:
    - Summary: `/admin/calllogs?username=900900&dir=outbound&profile=lte`
    - Raw: `/admin/calllogs?username=900900&dir=outbound&profile=lte&view=raw`

- **Timestamp**: 2026-03-29T18:30:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Frontend cache self-heal + restore manual Enable Calls login trigger (no SIP/media behavior changes)
- **Files changed**:
  - `Makefile`
  - `www/index.html`
  - `www/index.html.template`
  - `nginx/site.conf`
  - `nginx/site.conf.template`
  - `www/app/runtime/controlBindings.js`
  - `www/app/runtime/registerFlow.js`
  - `www/app/runtime/mobileRecovery.js`
  - `www/app/runtime/swWakeHandler.js`
  - `www/app/sipRegister.js`
  - `www/app/incoming/handlers.js`
  - `www/app/outgoing/call.js`
  - `docs/hard-refresh-self-heal.md`
- **Restart required**:
  - phone-nginx: yes (redeploy static assets + recreate/reload)
  - browser: no manual cache clearing required; clients should self-heal on next open
- **Verified result**:
  - `make render` succeeds with the unresolved-variable guard intact.
- **Next safe step**:
  - Recreate `phone-nginx`, then on Android:
    - confirm build indicator shows `running==latest`
    - entering credentials does not auto-register
    - only clicking **Enable Calls** initiates registration

- **Timestamp**: 2026-03-30T02:30:00Z
- **AI**: Cascade (Windsurf)
- **Session scope**: Android hard-refresh auto-login fix (frontend module graph/versioning only; no SIP/media changes)
- **Root cause (proven)**:
  - Android was still loading a pinned, stale ES module chain via hardcoded `?v=...` imports.
  - Specifically:
    - `www/app/main.js` imported `./runtime/android/bootstrapAndroid.js?v=1773033002`
    - `www/app/runtime/android/callFlowAndroid.js` imported `../controlBindings.js?v=1773032001`
  - That stale `controlBindings.js?v=...` bound handlers that triggered `runOneTapEnableFlow()` on password entry, which called `startAndRegister()`.
- **Fix (final)**:
  - Removed fixed `?v=` Android module pins and switched Android boot to a runtime `cb`-tokenized module graph.
  - Android now loads, consistently:
    - `bootstrapAndroid.js?cb=<token>`
    - `callFlowAndroid.js?cb=<token>`
    - `controlBindings.js?cb=<token>`
- **Files changed (final resolution)**:
  - `www/app/main.js`
  - `www/app/runtime/android/bootstrapAndroid.js`
  - `www/app/runtime/android/callFlowAndroid.js`
- **Restart required**:
  - phone-nginx: redeploy static assets and reload/recreate if your deploy does not live-update the nginx docroot
  - Android client: close tab/app and reopen (recommended); no manual cache clearing should be required if no-store headers + self-heal are live
- **Verified result**:
  - Android Chrome/Google browser no longer auto-logins after hard refresh.
  - Password entry no longer auto-starts registration.
  - Only **Enable Calls** starts first registration.
  - Android DevTools proof:
    - no `bootstrapAndroid.js?v=...`
    - no `controlBindings.js?v=...`
    - `?cb=` chain visible for Android runtime modules
- **Verification steps (Android DevTools)**:
  - Open Remote DevTools -> Network (JS) and confirm:
    - requests include `bootstrapAndroid.js?cb=` and `controlBindings.js?cb=`
    - no requests include `bootstrapAndroid.js?v=` or `controlBindings.js?v=`
  - Enter username/password: must not register.
  - Tap **Enable Calls**: registration begins.

## Runtime evidence so far
- Wi-Fi calls gather candidates successfully
- Admin call logs show Wi-Fi candidate presence such as:
  - `relay=0 host=2 srflx=1 total=3`
- Therefore Wi-Fi issue is not a TURN-unreachable problem
- Problem is in shared SIP/RTPEngine media handling

## Current task
Enhance call/media observability (frontend event schema + admin call log filters) so LTE/media issues can be debugged without browser console access.
Do not attempt LTE media fixes in this task.

## Current known status

### Working
- Registration works
- Frontend diagnostics widget works
- Admin pages on WireGuard work:
  - `/dashboard`
  - `/diagnostics/errors`
  - `/admin/routing`
  - `/admin/calllogs`

### New in this session (observability)
- Admin call logs page now supports filtering by username/extension, domain, AOR, direction, mode (Wi-Fi/LTE), call-id, event type, and errors-only
- Call log rows include richer identity + peer fields and a per-call `trace` link (Call-ID scoped view)
- Frontend emits additional structured media-path decision events and timeline markers (offer/answer, invite-sent, answer-clicked, established/ended, selected-pair, remote-audio attached/play)

### Verified
- Wi-Fi to Wi-Fi two-way audio

### Not yet confirmed
- LTE to LTE audio
- LTE to Wi-Fi audio

## Runtime evidence so far
- Wi-Fi calls gather candidates successfully
- Admin call logs show Wi-Fi candidate presence such as:
  - `relay=0 host=2 srflx=1 total=3`
- Therefore Wi-Fi issue is not a TURN-unreachable problem
- Problem is in shared SIP/RTPEngine media handling

## Confirmed Wi-Fi regression cause
The active Wi-Fi one-sided-audio regression was traced to:
- `kamailio/routes/60-media.cfg`
- `MEDIA_ANSWER` else branch (outgoing call, PBX -> WebRTC answer path)

A later change had added extra RTPEngine flags:
- `rtcp-mux=answer`
- `codec-mask=PCMA`
- `codec-mask=PCMU`

This differed from the last known working state and is believed to cause asymmetric audio.

## Fix applied
`kamailio/routes/60-media.cfg` now restores the outgoing PBX->WebRTC answer path to:

`rtpengine_answer("RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive")`

Also note:
- the earlier `media-address=$env(KAM_PUBLIC_IP)` addition to shared PBX->WebRTC paths had already been reverted
- frontend LTE guard code was NOT identified as the Wi-Fi regression cause

## Restart status
Kamailio was restarted at ~02:41 AM PKT 2026-03-29 (after fix was written at 02:37).
The fix is **live** in the running container.

**Next step: test a Wi-Fi to Wi-Fi call.**

If the call is still one-sided after confirming two browsers are registered:
- Check browser console on the CALLEE side for `[incoming:media]` log lines
- Look for: "Remote audio bound to audio element" and "Audio playing"
- If these are absent, the track is not reaching `bindAndPlay`
- If present but audio is silent, run `document.getElementById('remoteAudio').volume` in devtools

## Archived: Restart command
```bash
docker compose restart kamailio
```