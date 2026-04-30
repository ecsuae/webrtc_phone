# NOW

## Current task
TASK-037 — Provisioning cleanup portability + frozen production guardrails.

## Current blocker(s)
- Provisioning cleanup script exists on old production VPS but is not yet committed/portable.
- Old production uses host systemd timer; new VM must be docker-first/repo-installable.

## Exact next safe step
- Commit repo-owned cleanup script and ignore script backup artifacts.
- Record that old `phone.srve.cc` is frozen production (no further runtime changes) and migrate scheduling to docker-first for new VM (`mobi.srve.cc`).

## Why this matters
Prevent stale provisioning slots from blocking new provisioning while keeping new VM deployments reproducible and docker-first.

## Task status (truthful)
- TASK-028: complete.
- TASK-029: pending.
- TASK-030: complete.
- TASK-031: complete/closed.
- TASK-032: pending; audio-delay work paused unless explicitly requested.
- TASK-033: pending.
- TASK-034: active; Docker/API fixed, awaiting browser runtime proof.
- TASK-035: active but paused while TASK-034 runtime proof is handled.
- TASK-036: complete.
- TASK-037: active.

## Scope guardrails
- Old production VPS `phone.srve.cc` is frozen: no further runtime changes unless explicitly approved.
- Do not touch `.env`.
- Do not delete provisioning data.
- Do not revoke devices.

## Already proven (facts)
- Cleanup dry-run can skip Kamailio-registered SIP usernames when JSON-RPC `ul.dump location` shows the AoR present (example: 100360).
- Kamailio restart window can temporarily empty usrloc; cleanup must not release slots during that window.
