# TASK-033 — Admin portal registered extensions page

## Title
Admin portal registered extensions page

## Status
Pending

## Start date
2026-04-13

## End date
—

## Scope
- Add one WireGuard/admin-only page that shows live registrations.
- Read-only only.

## Goals
- Show **Kamailio live usrloc** registrations.
- Show **PBX (FreeSWITCH/FusionPBX) live registrations**.
- Show a merged status per AOR/extension:
  - present in Kamailio only
  - present in PBX only
  - present in both
  - missing in both
- If one source is unavailable, still render the page and show source health clearly.

## Non-goals
- No write actions.
- No changing registration behavior.
- No changing SIP routing.

## Current blocker
- PBX live registrations query path is not yet wired.

## Exact next safe step
- Decide and implement the PBX registrations read-only source of truth:
  - WireGuard-only HTTP endpoint on PBX, or
  - SSH + `fs_cli -x "sofia status profile internal reg"`, or
  - FreeSWITCH ESL (read-only).

## Timestamped task history
- 2026-04-13 07:15 PKT | START  | TASK-033 | Admin portal: add read-only registrations comparison page (Kamailio usrloc vs PBX). | AI: Cascade
- 2026-04-13 07:15 PKT | CHANGE | TASK-033 | Enabled localhost-only Kamailio JSON-RPC over HTTP on 8443 (/RPC) for live usrloc query; added /admin/registrations route + initial renderer + live Kamailio snapshot service (PBX side pending). | AI: Cascade
- 2026-04-13 07:19 PKT | VERIFY | TASK-033 | `/admin/registrations` renders (HTTP 200) after rebuilding/restarting push-server; Kamailio live source reachable; PBX registrations source still pending. | AI: Cascade
- 2026-04-13 10:04 PKT | CHANGE | TASK-033 | `/admin/registrations` now renders a single merged/normalized table (extension/AOR/status/contact/user-agent/expires/transport); Dashboard includes a Registrations link; PBX remains optional/unconfigured. | AI: Cascade
- 2026-04-13 10:04 PKT | VERIFY | TASK-033 | Verified `/dashboard` and `/admin/registrations` return HTTP 200 and include a visible `/admin/registrations` link after rebuilding push-server. | AI: Cascade
- 2026-04-13 10:28 PKT | CHANGE | TASK-033 | Added PBX DNS/domain visibility: PBX normalization exposes `pbxDnsName`/`pbxDomain`, and `/admin/registrations` renders a PBX DNS column with safe placeholder when missing. | AI: Cascade
- 2026-04-13 10:28 PKT | VERIFY | TASK-033 | Verified `/admin/registrations` returns HTTP 200 and includes PBX DNS column after rebuilding push-server. | AI: Cascade
