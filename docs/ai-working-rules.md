# AI Working Rules

# STOP — READ THIS FILE IN EVERY SESSION

This file is the standing instruction set for any AI working on this WebRTC SIP softphone project.

## Read-order rule
- Do not define a separate startup order here.
- The mandatory startup/read order is defined only in `docs/00-read-first.md`.
- Follow `docs/00-read-first.md` exactly.
- Do not invent a new read order.
- Do not scan the whole repo by default.
- Read other docs only if the current task truly needs them.

---

## Docker/runtime verification rule
- This project runs inside Docker containers.
- Do not assume host system commands verify the real running app.
- Prefer commands executed against the correct container/service, for example:
  - `docker compose exec <service> ...`
  - `docker compose logs <service>`
  - container-local file checks
  - live route checks against the running containerized app
- Host-only commands are not enough unless the task is explicitly about the host.
- When reporting verification, clearly state whether it was verified:
  - in container
  - via live HTTP route
  - via browser/runtime
  - or only by code inspection

---

## Protected working behavior
- Wi-Fi ↔ Wi-Fi calling is currently working and must not be broken.
- Any media-path fix must avoid regressing the already-working Wi-Fi ↔ Wi-Fi path.
- Prefer fixes scoped only to LTE ↔ Wi-Fi or other failing paths.

---

## Core workflow rules
- Work only within the current task scope.
- Work only on the active task in `docs/now.md` unless the user explicitly changes scope.
- Do not restart old investigations unless the current task requires it.
- Protect already working features.
- Prefer small, safe, incremental, reversible changes.
- Trust runtime evidence over code assumptions.
- Do not claim a fix is complete unless practical verification matches expectations.

---

## Protected working areas
Do not break or casually refactor these areas:
- registration
- outgoing calls
- incoming calls
- hold / unhold
- push notifications
- Kamailio / RTPEngine integration
- multi-domain support
- mobile-specific runtime behavior
- stable production UI behavior already in use

If a new change is risky, isolate it behind:
- a feature flag
- a separate module
- a disabled-by-default path
- a separate route/service/helper file where practical

---

## Code size and split rule
- Keep every code file small and focused.
- Target maximum file size: **150 to 200 lines** for normal code files.
- If a file grows beyond that range, split it into smaller focused modules/files.
- Do not keep adding logic into large files just because they already exist.
- Split by responsibility, for example:
  - routes
  - services
  - helpers
  - UI sections
  - platform-specific runtime
  - feature-specific handlers
- Avoid monolithic files.
- When splitting, protect existing behavior and avoid mixing unrelated refactors into the current task.
- If a file must temporarily remain above 200 lines, record the reason in `docs/session-log.md` and make splitting it the next safe step.

---

## Architecture and separation rules
Maintain clean separation between:
- frontend app
- registration/auth flow
- SIP call control
- media handling
- incoming call logic
- outgoing call logic
- hold/unhold
- push-server backend
- Kamailio / RTPEngine / Nginx / Coturn infrastructure
- docs / workflow files

Do not mix unfinished logic into stable production flows.

---

## Runtime verification rule
Always verify important fixes against live behavior when practical.

For SIP/WebRTC/media issues, prefer real runtime evidence such as:
- browser console logs
- admin call logs
- push-server logs
- Kamailio logs
- FreeSWITCH logs
- tcpdump / sngrep
- actual call/media behavior

If runtime evidence and docs disagree:
- trust runtime evidence
- then update the docs

---

## Deployment and config rules
- Keep the project container-based and deployment-friendly.
- Keep config env-driven when practical.
- Do not hardcode domains, IPs, usernames, passwords, ports, or environment-specific values unless explicitly required.
- Prefer template-driven or env-driven config over manual edits.
- Do not edit generated files if the real source is a template.

---

## Documentation rules
Documentation is mandatory.

Before ending every session:
- append to `docs/session-log.md`
- append to `docs/change-ledger.md` if any files changed
- update `docs/now.md` so it reflects the true current state
- update `docs/known-good-baseline.md` only if a baseline was actually verified

Do not finish a task with code changed but workflow docs stale.

---

## now.md rule
`docs/now.md` is the single source of truth for the current active task.

It must stay short and current.

It must always answer:
- current task
- why this task matters
- what is already proven
- what must not be changed
- current blocker
- files most likely involved
- exact next safe step

Do not turn `now.md` into a long history file.

---

## session-log.md rule
`docs/session-log.md` is mandatory and append-only.

Every AI session must add:
- one `START` line
- zero or more `NOTE` / `CHANGE` / `VERIFY` / `BLOCKED` lines
- one `STOP` line with total worked time

Use one line per event.

Format:
`YYYY-MM-DD HH:MM PKT | TYPE | TASK-ID | short message | AI: Name`

Examples:
- `2026-03-30 09:10 PKT | START  | TASK-018 | Verify correlated export for both call legs | AI: ChatGPT`
- `2026-03-30 09:42 PKT | CHANGE | TASK-018 | Added corrId-first export bundle in callLogExport.js | AI: ChatGPT`
- `2026-03-30 09:55 PKT | VERIFY | TASK-018 | export.json returns one bundle with both SIP Call-IDs | AI: ChatGPT`
- `2026-03-30 10:02 PKT | STOP   | TASK-018 | Session end | worked 52m | AI: ChatGPT`

Keep entries short and factual.

---

## Task-ID rule
Every task must have a stable task ID:
- `TASK-001`
- `TASK-002`
- `TASK-003`

If the same task is resumed later:
- reuse the same task ID
- add `attempt #2`, `attempt #3`, etc. in the message if helpful

Example:
- `2026-03-31 11:05 PKT | START | TASK-018 | Re-open export verification | attempt #2 | AI: Claude`

---

## change-ledger.md rule
`docs/change-ledger.md` is only for actual changes.

Do not use it for guesses, plans, or thoughts.

Each entry must include:
- timestamp
- AI name
- task ID
- exact files changed
- restart required or not
- exact verified result
- next safe step

If nothing changed, do not create a fake ledger entry.

---

## known-good-baseline.md rule
Update `docs/known-good-baseline.md` only when a baseline was actually verified.

Do not update it based on assumptions.

Baseline entries should record:
- timestamp
- AI name
- exact environment/context
- exact test performed
- exact verified result
- exact files changed since previous baseline if any
- restart required or not

---

## Handoff rule
A new AI must be able to continue by reading only:
1. `docs/00-read-first.md`
2. `docs/ai-working-rules.md`
3. `docs/now.md`
4. `docs/session-log.md`
5. `docs/change-ledger.md`
6. `docs/known-good-baseline.md`

Do not force new AIs to scan the whole repository blindly.

---

## Archive and weekly rotation rule
To prevent workflow files from becoming too large:

Rotate weekly on Monday, or earlier if large:
- `docs/session-log.md`
- `docs/change-ledger.md`

Archive them under:
- `Work_Flow/YYYY/MM-Mon/`

Example:
- `Work_Flow/2026/03-Mar/2026-03-23_to_2026-03-29_session-log.md`
- `Work_Flow/2026/03-Mar/2026-03-23_to_2026-03-29_change-ledger.md`

Rules:
- do not delete history
- create a fresh live file in `docs/`
- keep `docs/now.md` short and current instead of letting it become a history dump

---

## Non-negotiable reminders
- Do not reintroduce known-bad fixes.
- Do not undo verified working behavior without explicit need.
- Do not switch to broad refactors during a focused bug task.
- Do not leave code files growing into large monoliths.
- Preferred max code file size is **150–200 lines**.
- If a file grows beyond that, split it.

---

## End-of-session rule
A session is not complete until all applicable steps are done:
- `docs/session-log.md` updated
- `docs/change-ledger.md` updated if files changed
- `docs/now.md` updated
- `docs/known-good-baseline.md` updated only if baseline truly changed or was verified