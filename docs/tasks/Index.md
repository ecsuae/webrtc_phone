# Task Index

_Last updated: 2026-04-30 10:40 PKT_

| Task | Title | Status | Start date | End date | One-line summary |
|---|---|---|---|---|---|
| TASK-026 | Kamailio isolation/refactor | Active | 2026-04-06 | — | Isolate and refactor Kamailio service/config ownership into clear repo-managed boundaries without changing runtime behavior. |
| TASK-027 | RTPEngine isolation | Complete | 2026-04-06 | 2026-04-07 | Migrated RTPEngine config ownership into repo-managed config to reduce split-brain risk while preserving behavior. |
| TASK-028 | Call log instrumentation fix | Complete | Unknown | Unknown | Push-server admin call-log isolation and `/admin/calllogs` summary diagnosis made operationally correct; frontend raw inbound proof deferred to TASK-029. |
| TASK-029 | Frontend inbound raw proof rows | Pending | Unknown | — | Add missing inbound raw proof event rows in real merged-parent call logs (frontend-only; raw remains additive). |
| TASK-030 | Nginx isolation/refactor | Complete | 2026-04-09 | 2026-04-09 | Made nginx runtime config template-driven via repo-owned wrapper with behavior-preserving routing. |
| TASK-031 | Desktop isolation/refactor | Complete | 2026-04-09 | 2026-04-13 | Desktop app isolation completed; remaining runtime/correctness work moved to TASK-032. |
| TASK-032 | Desktop runtime/correctness | Pending | 2026-04-13 | — | Audio-delay work paused after real-number IVR was heard properly; resume only by explicit request. |
| TASK-033 | Admin portal registered extensions page | Pending | 2026-04-13 | — | Add a read-only admin page showing live extension registrations from both Kamailio and PBX, including dual-registration match status. |
| TASK-034 | Desktop auto provisioning | Active | 2026-04-25 | — | Docker/API active-slot logout and stale TTL release pass; browser real logout click-path proof is still required. |
| TASK-035 | Desktop dialer UI/runtime polish | Active | 2026-04-26 | — | Remove desktop mobile-keyboard icon and fix duplicate physical-key digit entry without touching mobile or SIP/media behavior. |
| TASK-036 | Docker timezone verification | Complete | 2026-04-26 | 2026-04-26 | Verified every active project container uses `TZ=Asia/Karachi` and reports PKT time; no compose change required. |
| TASK-037 | Provisioning cleanup portability + frozen production guardrails | Active | 2026-04-30 | — | Commit and harden provisioning stale-slot cleanup and make scheduling docker-first for new VM; freeze old VPS runtime changes. |
| TASK-038 | Standalone plug-and-play deployment (${DOMAIN}) — WireGuard + Let’s Encrypt | Active | 2026-04-30 | — | Make new VPS deployment reproducible: env-driven configs, Docker WireGuard, and Docker ACME cert issuance/renewal without exposing admin publicly. |

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
