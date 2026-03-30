# Current AI Handoff

_This is the single source of truth for cross-AI continuity._
_Keep it short, current, and rotated weekly._

## How every AI must work (mandatory)

### Read only (default)
Before doing any work, read only:
- `docs/ai-working-rules.md`
- `docs/current-task-status.md`
- `docs/change-ledger.md`
- `docs/current-ai-handoff.md`

Do **not** scan the whole repo or all docs by default.

### Inspect only what you need
- Inspect only the minimum files required for the current task.
- Protect already working areas. If unsure, do not refactor.

### Preserve handoff history
- Do not overwrite prior handoff content blindly.
- Update current sections and preserve still-relevant notes until the file is rotated.

### Runtime reality overrides docs
- If runtime reality differs from these docs, update the workflow docs immediately after verification.

### Required end-of-session updates
Before ending every AI session, update these live docs:
- `docs/current-task-status.md`
- `docs/change-ledger.md`
- `docs/current-ai-handoff.md`
- `docs/known-good-baseline.md` (**only if baseline changed**)

Each update MUST include:
- timestamp
- AI signature/name (Claude / Windsurf / ChatGPT / other)
- exact files changed
- restart required or not
- exact verified result
- next safe step

### Rotation / truncation rule (do not ignore)
- Do NOT let any live workflow file grow endlessly.
- When any live workflow file reaches ~400 lines:
  - rotate/archive it weekly using week-range filenames, e.g.:
    - `2026-03-23_to_2026-03-29_current-ai-handoff.md`
  - place archives under the correct month folder:
    - `Work_Flow/2026/03-Mar/`
  - keep only the current live versions in `docs/`
  - after rotation, create fresh trimmed live files in `docs/` with only current essential state

---

## Current session handoff (keep current)

### Timestamp
- 2026-03-29

### AI
- Cascade (Windsurf)

### Task scope guardrails
- Observability/logging/admin filtering tasks only unless explicitly told otherwise
- Do not change media/call behavior unless the task explicitly requires it

### Current task
- Enhance call/media observability and admin call log usefulness for LTE/media debugging

### What changed most recently
- Workflow/handoff system created:
  - `docs/change-ledger.md`
  - `docs/current-ai-handoff.md`
  - `docs/known-good-baseline.md`
  - `Work_Flow/2026/<month>/` archive folders
- Admin call logs page: richer filters + columns + per-call trace view (Call-ID)
- Frontend emits richer structured call/media events and explicit event types for timeline and media-path markers

### Where to look first (files)
- `docs/current-task-status.md`
- `docs/12-lte-media-diagnostics.md`
- `push-server/src/admin/callLogPage.js`
- `push-server/src/services/callLogStore.js`
- `www/app/outgoing/call.js`
- `www/app/incoming/handlers.js`
- `www/app/pc/bind.js`
- `www/app/registration/primary.js`

### Restart / refresh expectations
- push-server restart required after server-side log/page/store changes
- hard refresh recommended after frontend logging changes

### Next safe step
- Run a Wi-Fi to Wi-Fi call test and confirm two-way audio baseline (do not change media routing until baseline is confirmed)
