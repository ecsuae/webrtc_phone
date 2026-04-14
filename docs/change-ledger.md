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


## Live index (keep this file small)

### Task histories (authoritative)
- TASK-027: `docs/tasks/TASK-027.md`
- TASK-028: `docs/tasks/TASK-028.md`
- TASK-029: `docs/tasks/TASK-029.md`
- TASK-030: `docs/tasks/TASK-030.md`
- TASK-031: `docs/tasks/TASK-031.md`

### Archives
- April 2026 archive (verbatim ledger snapshot): `docs/archive/change-ledger-2026-04.md`

### Recent activity pointers

- TASK-031 (desktop isolation/refactor): complete; full history: `docs/tasks/TASK-031.md`
- TASK-032 (desktop runtime/correctness): active; keep this ledger focused on runtime bug-fix work only.

## Current week entries

### 2026-04-13T20:52:00Z — TASK-033: PBX DNS column prefers hostname over IP when present
- **AI**: Cascade
- **Scope**: admin registrations page renderer only (read-only).
- **Change**:
  - Updated PBX DNS/domain resolver to prefer hostname candidates (pbxDnsName → pbxDomain → AOR host if not IP → other hostname fields) and only fall back to IP when no hostname exists; else `Unknown`.
- **Files changed**:
  - `push-server/src/admin/registrationsPage.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Live route (container): `/admin/registrations` returns HTTP 200 and PBX DNS selection no longer chooses non-domain labels.
- **Next safe step**:
  - Confirm in the target environment that rows with an available hostname (e.g. `fusn02.srve.cc`) render that hostname instead of the IP.

### 2026-04-13T06:20:00Z — TASK-032: inbound sender-binding proof + sender-track force (desktop inbound)
- **AI**: Cascade
- **Scope**: desktop inbound diagnostics + sender binding hardening only (no SIP/Kamailio/PBX changes).
- **Change**:
  - Persist acquired mic track/stream ids on inbound answer for later comparison.
  - On inbound Established, emit `desktop-inbound-audio-proof` at ~2.5s and ~10s with sender vs acquired mic ids, transceiver direction/currentDirection, outbound RTP counters, and sender energy when available.
  - If sender track is not bound to the acquired local mic track, force it via `replaceTrack` to the local stream audio track (desktop-owned only).
- **Files changed**:
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/incoming/desktopOnIncomingEstablished.js`
  - `www/app/desktop/incoming/ext/desktopInboundSenderProof.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No (frontend/runtime change; requires browser reload to pick up).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Reproduce the failing ext-to-ext call and confirm `desktop-inbound-audio-proof` shows senderTrackId == acquiredLocalMicTrackId; if bound but energy stays near-zero while speaking, treat as silent-source/capture issue.

### 2026-04-13T06:04:00Z — TASK-032: record bidirectional-media proven ext-to-ext call (docs-only)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Change**:
  - Recorded a verified ext-to-ext call as bidirectional-media proven (not a current one-way-audio failure).
- **Files changed**:
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only (docs updated to reflect provided runtime proof).
- **Next safe step**:
  - Audit admin verdict/anomaly synthesis naming so bidirectional proof classifies as OK (see TASK-032 notes).

### 2026-04-13T05:51:00Z — TASK-032: outbound receive/render proof parity + observability verdict
- **AI**: Cascade
- **Scope**: diagnostics parity only (no SIP/PBX behavior changes).
- **Change**:
  - Desktop outbound established calls now emit `receive-render-proof` at 5s and 10s (remote audio element state, receiver track state, RTP counters, energy, codec).
  - Media verdict synthesis now classifies transport+RTP present but missing render-proof as `incomplete-observability` (diagnostics incomplete) instead of implying likely media failure.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundEstablished.js`
  - `push-server/src/admin/callLogMediaVerdictSynthesis.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: rebuild/restart push-server to apply verdict synthesis change.
  - Frontend: browser reload required to pick up desktop JS changes.
- **Next safe step**:
  - Run one ext-to-ext test call and confirm both legs show comparable `receive-render-proof` rows; verify verdict moves from `asymmetric-media-proof` to either `two-way-audio-proven` or `incomplete-observability`.

### 2026-04-13T05:36:00Z — TASK-032: add desktop outbound one-way-audio proof event
- **AI**: Cascade
- **Scope**: desktop runtime diagnostics only (no behavior change intended).
- **Change**:
  - Added `desktop-outbound-audio-proof` event emitted ~2.5s after Established to capture:
    - sender track id vs local mic track id
    - track enabled/muted/readyState
    - transceiver direction/currentDirection
    - outbound RTP packets/bytes/audioLevel
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/now.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No (frontend/runtime change; requires browser reload to pick up).
- **Verified result**:
  - Code inspection: proof event is scheduled in desktop outbound Established path.
- **Next safe step**:
  - Run one failing ext-to-ext call and correlate proof events with PBX bridge evidence using `callId`/`corrId`.

### 2026-04-13T05:28:00Z — TASK-033: show PBX DNS/domain on registrations table
- **AI**: Cascade
- **Scope**: read-only admin portal enhancement.
- **Change**:
  - Normalized PBX rows now include `pbxDnsName` (from `PBX_REG_HTTP_URL` hostname) and `pbxDomain` (from SIP AOR host).
  - `/admin/registrations` merged table now shows a **PBX DNS** column (safe placeholder when missing).
- **Files changed**:
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - `/admin/registrations` returns HTTP 200 and includes the `PBX DNS` column.
- **Next safe step**:
  - Wire authoritative PBX live registrations read (read-only) so PBX rows populate in production.

### 2026-04-13T05:04:00Z — TASK-033: merged registrations table + dashboard link
- **AI**: Cascade
- **Scope**: read-only admin portal UI + normalization only.
- **Change**:
  - `/admin/registrations` now renders a single merged table with normalized columns (extension/AOR/status/contact/user-agent/expires/transport).
  - Dashboard navbar now includes a visible **Registrations** link.
- **PBX source**:
  - Optional HTTP scrape via `PBX_REG_HTTP_URL` (still non-fatal; page renders health when unavailable).
- **Files changed**:
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
  - `push-server/dashboard.html`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - `/dashboard`, `/admin/routing`, `/admin/calllogs`, `/admin/registrations` return HTTP 200.
  - `/dashboard` and admin pages contain a `/admin/registrations` link.
- **Next safe step**:
  - Wire authoritative PBX live registrations read (read-only) so merged view can show PBX-only and both.

### 2026-04-13T02:27:00Z — Docs: restore missing TASK-032 task file
- **AI**: Cascade
- **Scope**: docs/workflow only (correction; no code changes).
- **Correction**:
  - Recreated missing `docs/tasks/TASK-032.md` from authoritative workflow history sources:
    - `docs/change-ledger.md`
    - `docs/session-log.md`
    - `docs/tasks/Index.md`
    - `docs/now.md`
- **Files changed**:
  - `docs/tasks/TASK-032.md`
  - `docs/change-ledger.md`
  - `docs/session-log.md`
- **Restart required**:
  - No
- **Verified result**:
  - `docs/tasks/TASK-032.md` exists in the worktree and matches recorded timestamps/status transitions.
- **Next safe step**:
  - None (docs correction only).

### 2026-04-13T02:19:00Z — TASK-033: /admin/registrations page renders (Kamailio live; PBX pending)
- **AI**: Cascade
- **Scope**: read-only admin feature.
- **Route**:
  - `/admin/registrations` (WireGuard-only)
- **Data sources**:
  - Kamailio usrloc: live via JSON-RPC over HTTP on `http://127.0.0.1:8443/RPC` (`ul.dump location`).
  - PBX registrations: not wired yet (page renders health as unavailable).
- **Verification**:
  - Rebuilt + restarted push-server so new route is live.
  - HTTP check: `/admin/registrations` returns 200.

### 2026-04-13T02:15:00Z — TASK-033: start admin registrations page (live Kamailio usrloc)
- **AI**: Cascade
- **Scope**: read-only admin feature.
- **Kamailio source of truth**:
  - Enabled JSON-RPC over HTTP (localhost-only) on `http://127.0.0.1:8443/RPC` to query live usrloc via `ul.dump`.
- **Admin portal wiring**:
  - Added `/admin/registrations` route and a read-only HTML page renderer.
  - PBX side is not yet wired (page must still render and show source health).
- **Files changed**:
  - `kamailio/kamailio.cfg`
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
  - `push-server/src/admin/routingPage.js`
  - `push-server/src/admin/callLogPage.js`
- **Next safe step**:
  - Implement PBX live registrations read path and complete merged dual-registration status rendering.

### 2026-04-13T01:56:00Z — TASK-026: split registration route (20-registration) into core + helpers
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving; size ceiling compliance).
- **Boundary completed**:
  - Split oversized `kamailio/routes/20-registration.cfg` into exactly two coherent include files:
    - `kamailio/routes/20-registration-helpers.cfg` (NAT fix, failure_route, local save, unregister)
    - `kamailio/routes/20-registration-core.cfg` (HANDLE_REGISTER + RELAY_REGISTER_TO_PBX)
  - `kamailio/routes/20-registration.cfg` is now an include-only wrapper.
- **Verification**:
  - In-container parse check BEFORE: `docker compose exec -T kamailio kamailio -c /etc/kamailio/kamailio.cfg -I` (OK)
  - In-container parse check AFTER: same command (OK)
- **Next safe step**:
  - Reduce `kamailio/kamailio.cfg` (still oversized) by extracting additional large route blocks into `kamailio/routes/*` includes.

### 2026-04-13T01:51:00Z — TASK-026: split incoming route (10-incoming) into core + did-map
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving; size ceiling compliance).
- **Boundary completed**:
  - Split oversized `kamailio/routes/10-incoming.cfg` into exactly two coherent include files:
    - `kamailio/routes/10-incoming-did-map.cfg` (DID→extension mapping helper route)
    - `kamailio/routes/10-incoming-core.cfg` (main `HANDLE_INCOMING_INVITE` route)
  - `kamailio/routes/10-incoming.cfg` is now an include-only wrapper.
- **Verification**:
  - In-container parse check BEFORE: `docker compose exec -T kamailio kamailio -c /etc/kamailio/kamailio.cfg -I` (OK)
  - In-container parse check AFTER: same command (OK)
- **Next safe step**:
  - Reduce `kamailio/routes/20-registration.cfg` (203 lines) via a similar two-file split, keeping REGISTER behavior identical.

### 2026-04-13T01:45:00Z — TASK-026: isolate Kamailio push route include (first boundary)
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving).
- **Boundary completed**:
  - Extracted push notification routing (`route[SEND_PUSH_NOTIFICATION]`) from the main `kamailio/kamailio.cfg` into a dedicated include file.
- **Files changed**:
  - `kamailio/kamailio.cfg`
  - `kamailio/routes/70-push.cfg`
- **Verification**:
  - Code inspection: `kamailio/kamailio.cfg` no longer defines `route[SEND_PUSH_NOTIFICATION]` and now includes `routes/70-push.cfg`.
  - Runtime/container verification: not performed in this step.
- **Next safe step**:
  - Run `kamailio -c` config parse in the container and verify inbound/outbound calls unchanged.

### 2026-04-13T01:38:00Z — Docs: task state update (TASK-032 → Pending; restore TASK-026)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Change**:
  - Marked TASK-032 as `Pending` (runtime verification paused).
  - Restored TASK-026 (Kamailio isolation/refactor) into `docs/tasks/` based on existing session-log history and set it as the active task.
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-026.md`

### 2026-04-13T01:26:00Z — TASK-032: desktop hard-refresh loop fix (one-shot consume)
- **AI**: Cascade
- **Scope**: desktop runtime UX fix (hard-refresh/cache only).
- **Proof / symptom**:
  - After manual hard refresh, `[POST_REFRESH_BOOT] hr=1 ... href=...&hr=1` and `[DESKTOP_HARD_REFRESH_PREV_CLICK] ... href=...&hr=1` observed.
  - Page refreshed again during early login input activity.
- **Fix**:
  - `www/app/desktop/runtime/ext/desktopCacheHardRefreshSetup.js` now consumes hard-refresh state on first boot:
    - clears `__desktop_hard_refresh_click_ts` from localStorage
    - removes `hr=1` from the URL via `history.replaceState`
    - emits `[DESKTOP_HARD_REFRESH_CONSUMED] ...` marker
- **Next safe step**:
  - Verify: one refresh click triggers exactly one reload; after reload, typing username does not reload; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T01:14:00Z — TASK-032: inbound stats 404 fix (pc/stats import path)
- **AI**: Cascade
- **Scope**: desktop inbound runtime unblock (stats/diag import only; no media behavior change).
- **Symptom**:
  - Browser tried to import `/app/desktop/pc/stats.js?...` and 404’d during inbound established flow.
- **Root cause**:
  - `www/app/desktop/incoming/ext/desktopIncomingPcStats.js` used a relative import path that resolved under `/app/desktop/...`.
- **Fix**:
  - Updated dynamic import URL from `../../pc/stats.js` to `../../../pc/stats.js` (resolves to real `www/app/pc/stats.js`).
- **Next safe step**:
  - Re-test inbound call establish: confirm `loadPcStats` import succeeds and stats snapshots continue without 404; then resume TASK-032 ext-to-ext SIP 480 proof pass.

### 2026-04-13T01:09:00Z — TASK-032: desktop bootstrap fix (export createDesktopInviter)
- **AI**: Cascade
- **Scope**: desktop runtime bootstrap unblock (export mismatch fix).
- **Fix**:
  - `www/app/desktop/outgoing/desktopStartCallSupport.js` now exports `createDesktopInviter` and `getDesktopOutboundDiagContext` for callers under `www/app/desktop/outgoing/ext/`.
- **Symptom**:
  - `SyntaxError: ... does not provide an export named 'createDesktopInviter'` from `desktopExtInviteFlow.js`.
- **Next safe step**:
  - Reload desktop app and confirm bootstrap/login UI renders; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T01:07:00Z — TASK-032: desktop bootstrap fix (remove stale outbound sender diagnostics import)
- **AI**: Cascade
- **Scope**: desktop runtime bootstrap unblock (no SIP logic changes).
- **Fix**:
  - Removed stale import of deleted `www/app/desktop/outgoing/desktopOutboundSenderDiagnostics.js`.
  - Updated `www/app/desktop/outgoing/desktopOutboundStateChange.js` to import the required functions from existing `www/app/desktop/outgoing/ext/` modules.
- **Verified result**:
  - Repo search returns zero references to `desktopOutboundSenderDiagnostics.js`.
- **Next safe step**:
  - Re-test desktop app loads past bootstrap and login UI renders; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T00:48:00Z — Docs: correct TASK-032 start date in task index
- **AI**: Cascade
- **Scope**: docs/workflow only (metadata consistency).
- **Files changed**:
  - `docs/tasks/Index.md`
- **Restart required**:
  - No
- **Verified result**:
  - `docs/now.md` shows TASK-032 active.
  - `docs/change-ledger.md` contains `2026-04-13T05:15:00Z — TASK-032: start state`.
  - `docs/tasks/Index.md` TASK-032 start date set to `2026-04-13`.
- **Next safe step**:
  - Continue TASK-032 runtime proof pass for desktop outbound ext-to-ext 480 branch.

### 2026-04-13T05:15:00Z — TASK-032: start state (runtime/correctness only; post-isolation)
- **AI**: Cascade
- **Scope**: runtime/correctness debugging only (no isolation/refactor work; desktop isolation is complete).
- **Handoff context**:
  - TASK-031 is complete/closed; authoritative history: `docs/tasks/TASK-031.md`.
- **Current blocker(s)**:
  - Desktop outbound extension-to-extension calls may reject/terminate early (477/480).
  - OS/browser mic indicator may remain on after hangup despite app-level release proof.
- **Exact next safe step**:
  - Reproduce 477/480 and mic-stuck reliably, then add observability-only instrumentation where needed (no refactors unless required by file-size ceiling).

### Archived TASK-031 entries

- Moved into `docs/tasks/TASK-031.md` (final historical record). This live ledger is intentionally kept minimal for TASK-032.
