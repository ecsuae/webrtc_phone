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
