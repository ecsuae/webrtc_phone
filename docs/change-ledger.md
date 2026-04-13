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
