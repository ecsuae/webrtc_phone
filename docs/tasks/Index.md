# Task Index

_Last updated: 2026-04-13 01:27 UTC_

| Task | Title | Status | Start date | End date | One-line summary |
|---|---|---|---|---|---|
| TASK-027 | RTPEngine isolation | Complete | 2026-04-06 | 2026-04-07 | Migrated RTPEngine config ownership into repo-managed config to reduce split-brain risk while preserving behavior. |
| TASK-028 | Call log instrumentation fix | Complete | Unknown | Unknown | Push-server admin call-log isolation and `/admin/calllogs` summary diagnosis made operationally correct; frontend raw inbound proof deferred to TASK-029. |
| TASK-029 | Frontend inbound raw proof rows | Pending | Unknown | — | Add missing inbound raw proof event rows in real merged-parent call logs (frontend-only; raw remains additive). |
| TASK-030 | Nginx isolation/refactor | Complete | 2026-04-09 | 2026-04-09 | Made nginx runtime config template-driven via repo-owned wrapper with behavior-preserving routing. |
| TASK-031 | Desktop isolation/refactor | Complete | 2026-04-09 | 2026-04-13 | Desktop app isolation completed; remaining runtime/correctness work moved to TASK-032. |
| TASK-032 | Desktop runtime/correctness | Active | 2026-04-13 | — | Fix ext-to-ext 477/480 and mic-stuck behavior without reopening desktop isolation/refactor work. |

## Status legend
- Active
- Pending
- Blocked
- Complete
- Archived

## Date rules
- Use exact dates from the task file when present
- Else use archive/history sources if available
- If no reliable source exists, write `Unknown`
- For active/open tasks, use `—` as end date
