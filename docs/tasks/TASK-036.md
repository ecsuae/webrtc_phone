# TASK-036 — Docker timezone verification

## Title
Docker timezone verification

## Status
Complete

## Start date
2026-04-26

## End date
2026-04-26

## Scope
- Docker/compose/timezone verification only.
- No desktop UI, SIP/media, backend/admin, provisioning, or feature changes.

## Result
- Active compose services: `coturn`, `kamailio`, `nginx`, `push-server`, `rtpengine`.
- `docker-compose.yml` sets `TZ=Asia/Karachi` for every active service.
- No `docker-compose.override.yml` / `compose.override.yml` file is present.
- `docker-compose copy.yml` exists but is an alternate/stale copy file and is not auto-loaded by Docker Compose.
- No compose changes, rebuild, restart, or recreate was required.

## Verification
- 2026-04-26 07:57 PKT | Docker-only: `docker compose config --services` lists `coturn`, `rtpengine`, `kamailio`, `push-server`, `nginx`; rendered config has `TZ: Asia/Karachi` for all five.
- 2026-04-26 07:57 PKT | Docker-only: `docker compose ps` shows running containers `coturn`, `kamailio`, `phone-nginx`, `push-server`, `rtpengine`.
- 2026-04-26 07:57 PKT | In-container: all five containers report `TZ=Asia/Karachi` and `date` output in `PKT`.
