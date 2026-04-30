# TASK-026 — Kamailio isolation/refactor

## Title
Kamailio isolation/refactor

## Status
Active

## Start date
2026-04-06

## End date
—

## Scope
- Kamailio config/service ownership only.
- Focus on split-brain reduction and repo-owned boundaries.

## Goals
- Make Kamailio runtime behavior easier to reason about by reducing split ownership between:
  - image/container defaults
  - ad-hoc local overrides
  - repo-owned config templates
- Keep behavior stable while moving ownership into clear, repo-managed boundaries.

## Non-goals
- No SIP feature changes.
- No desktop/mobile app runtime changes.
- No FreeSWITCH/PBX architecture changes.

## Current blocker
- None.

## Exact next safe step
- Review existing Kamailio isolation work history (session-log evidence below).
- Identify the next smallest behavior-preserving Kamailio isolation step (one change at a time).
 - Deferred: admin registrations page work (TASK-033) is active.

## Timestamped task history
- 2026-04-06 08:37 PKT | START  | TASK-026 | Kamailio isolation audit + minimal split-brain cleanup (remove unused PBX defines from local.cfg) | AI: Cascade
- 2026-04-06 08:37 PKT | CHANGE | TASK-026 | Removed unused PBX_IP/PBX_PORT defines from kamailio/local.cfg to keep PBX ownership env-driven; advertise/public IP macros unchanged | AI: Cascade
- 2026-04-06 08:37 PKT | VERIFY | TASK-026 | Verified kamailio config parses in container: kamailio -c /etc/kamailio/kamailio.cfg -I | AI: Cascade
- 2026-04-06 08:37 PKT | STOP   | TASK-026 | Session end | worked 10m | AI: Cascade
- 2026-04-13 06:38 PKT | NOTE   | TASK-026 | Task file restored into `docs/tasks/` based on existing history; TASK-032 set Pending while runtime testing is paused. | AI: Cascade
- 2026-04-13 06:45 PKT | CHANGE | TASK-026 | Isolation boundary: extracted `route[SEND_PUSH_NOTIFICATION]` from `kamailio/kamailio.cfg` into `kamailio/routes/70-push.cfg` include (behavior intended identical). | AI: Cascade
- 2026-04-13 06:51 PKT | CHANGE | TASK-026 | Isolation boundary: split `kamailio/routes/10-incoming.cfg` into `10-incoming-core.cfg` + `10-incoming-did-map.cfg`; parse check `kamailio -c /etc/kamailio/kamailio.cfg -I` OK before/after. | AI: Cascade
- 2026-04-13 06:56 PKT | CHANGE | TASK-026 | Isolation boundary: split `kamailio/routes/20-registration.cfg` into `20-registration-core.cfg` + `20-registration-helpers.cfg`; parse check `kamailio -c /etc/kamailio/kamailio.cfg -I` OK before/after. | AI: Cascade
