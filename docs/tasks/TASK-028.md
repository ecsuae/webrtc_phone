# TASK-028 — Call Log Instrumentation Fix (push-server isolation + /admin/calllogs summary correctness)

## Task title
Call Log Instrumentation Fix: make `/admin/calllogs` summary diagnosis reflect current merged-parent evidence, while keeping raw logs authoritative.

## Scope and guardrails
- Scope:
  - push-server service isolation work around admin call logs
  - `/admin/calllogs` **summary** view diagnosis/synthesis correctness
- Do not change:
  - routes, config, or access control semantics
  - raw/native logging (raw remains additive only)
  - SIP/media behavior

## Why it mattered
Operators need a reliable summary view that:
- prefers current merged-parent call evidence over stale/child/orphan artifacts
- produces clear operator-facing diagnosis rows
- avoids misleading warnings when both legs have strong playback proof

## Work completed (this task)
- push-server admin call-log code was isolated/consolidated under `push-server/src/admin/*`.
- summary view was wired to the extracted summary transform pipeline.
- summary synthesis was improved so verdict/anomaly rows prioritize merged-parent evidence and suppress stale/orphan duplicates.
- summary is now useful enough for operator troubleshooting.

## Completion decision (truthful)
TASK-028 is being closed **because the push-server isolation + summary diagnosis work is complete enough to be operationally useful**, even though a separate frontend-only gap remains.

## Deferred / not completed under TASK-028
Frontend inbound **raw** instrumentation proof rows are still missing in runtime evidence for real inbound calls and are deferred to a new task:
- `inbound-play-attempt`
- `inbound-play-resolved`
- `inbound-play-rejected`
- `inbound-audio-route-snapshot`
- `inbound-audio-element-state`
- inbound `receive-render-proof`
- inbound `remote-audio-play-ok`

## Next safe step
Proceed under the new frontend-focused follow-up task (see `docs/tasks/TASK-029.md`).
