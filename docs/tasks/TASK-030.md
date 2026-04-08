# TASK-030 — Nginx: refactor and isolate nginx service/config (isolation-first)

## Task title
Refactor and isolate the nginx service/config so nginx ownership is repo-contained, reversible, and does not leak responsibilities into other services.

## Scope and guardrails
- Scope: nginx service/config isolation only (repo files under `nginx/`, related `docker-compose.yml` wiring, and nginx-owned static web serving boundaries).
- Do not change:
  - push-server summary synthesis, raw logging, or admin tooling behavior
  - TASK-029 frontend missing inbound raw proof rows work
  - SIP/media behavior, Kamailio routing, or RTPEngine behavior
- Isolation-first means: prefer reversible, config-move / mount / wiring changes that preserve runtime behavior.

## Problem statement
nginx currently exists in-repo, but ownership boundaries and isolation guarantees are not yet documented and/or enforced as a standalone service layer.

This task exists to make nginx configuration and service wiring cleanly isolated so future changes do not create cross-service coupling or “split brain” config ownership.

## Required outcome / acceptance
- nginx config is clearly owned by the repo under `nginx/`.
- nginx service wiring is isolated and explicit (compose/service boundaries are clear and reversible).
- No push-server calllogs/summary/logging code is touched as part of this task.
- No TASK-029 instrumentation work is mixed into this task.

## Notes
- Keep changes minimal and behavior-preserving.
- Prefer “move config ownership” and “tighten boundaries” over refactors that risk downtime.

## Current nginx ownership + mounts (inventory)
- Compose wiring (current repo state):
  - nginx service mounts `./nginx/phone.srve.cc.conf` to `/etc/nginx/conf.d/default.conf:ro`.
  - nginx service mounts `./www` to `/var/www/phone:ro`.
  - nginx service mounts `./certs` to `/certs:ro`.
- Repo nginx config files present:
  - `nginx/phone.srve.cc.conf.template` (template with `${DOMAIN}`)
  - `nginx/phone.srve.cc.conf` (concrete instance with `server_name phone.srve.cc`)

## Isolation-first plan (behavior-preserving)
Goal: make nginx config ownership unambiguous and env/template-driven without changing request routing behavior.

Plan:
1. Keep `nginx/phone.srve.cc.conf.template` as the source-of-truth.
2. Switch nginx container to generate `/etc/nginx/conf.d/default.conf` from the template at startup (envsubst), rather than mounting a concrete per-domain file.
3. Keep all routing/locations identical (no changes to `/ws`, `/api/`, or static file cache headers in this step).
4. Keep rollback trivial by retaining the current concrete config file and the ability to mount it directly.

## Timestamped task history

### 2026-04-09T03:41:00Z — Step 1: make nginx runtime config template-driven (wrapper renders template at container start)
- **Change**:
  - Added a repo-owned nginx startup wrapper script that renders `nginx/phone.srve.cc.conf.template` into `/etc/nginx/conf.d/default.conf` at container start using `envsubst`.
  - Updated only the nginx service in `docker-compose.yml` to use the wrapper and mount the template, so the concrete per-domain file is no longer the runtime source of truth.
- **Files changed**:
  - `nginx/entrypoint-wrapper.sh`
  - `docker-compose.yml`
- **Restart required**:
  - Yes (nginx container/service must restart to load new entrypoint + config rendering).
- **Verified result**:
  - Container:
    - nginx started and wrapper logged: rendered `/etc/nginx/conf.d/default.conf` from template with `DOMAIN=phone.srve.cc`.
    - `nginx -t` succeeded in-container.
    - Rendered `default.conf` shows `server_name phone.srve.cc` (DOMAIN substituted).
  - Live route:
    - `http://127.0.0.1/` returned `301` (expected redirect to https).
    - `http://127.0.0.1/ws` returned `301` (expected redirect to https).
    - `https://127.0.0.1/index.html` returned `200` (TLS static serving works; tested with curl -k).
  - **Next safe step**:
  - Optional follow-up: add a websocket-specific check (Upgrade) to validate `/ws` upgrade path without relying on a full SIP UA.

## Next safe step
Optional: add a websocket Upgrade probe for `/ws` to validate upgrade semantics (still nginx-only) without involving frontend/runtime.
