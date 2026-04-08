# NOW

## Current task
TASK-030 — nginx: refactor and isolate nginx service/config (isolation-first).

## Why this matters
nginx is the front door for web assets and edge HTTP behavior. Clear nginx config/service ownership boundaries reduce split-brain risk, keep isolation reversible, and prevent web-serving/edge concerns from coupling into other services.

## Task status (truthful)
- TASK-028: complete (push-server isolation + `/admin/calllogs` summary diagnosis work complete enough; do not reopen).
- TASK-029: pending (missing inbound raw proof rows in raw logs).
- TASK-030: complete enough to close (template-driven runtime config is in place and verified; optional websocket Upgrade probe is deferred).

## Scope guardrails (for current work)
- Scope: nginx service/config isolation only.
- Do not mix with TASK-029 missing inbound raw proof rows.
- Do not touch push-server summary/logging/admin.

## Already proven (TASK-030)
- Repo owns both:
  - `nginx/phone.srve.cc.conf.template` (template; `${DOMAIN}`)
  - `nginx/phone.srve.cc.conf` (concrete rollback file; not used as runtime source of truth after Step 1)
- Step 1 implemented: nginx runtime config is now rendered from the repo template at container start via `nginx/entrypoint-wrapper.sh` + nginx service wiring in `docker-compose.yml`.

## Verified (TASK-030)
- Container:
  - nginx started; wrapper rendered `/etc/nginx/conf.d/default.conf` with DOMAIN substituted; `nginx -t` succeeded.
- Live routes:
  - `http://127.0.0.1/` returned `301`
  - `http://127.0.0.1/ws` returned `301`
  - `https://127.0.0.1/index.html` returned `200` (tested with curl -k)

## Current blocker
- None for the required scope. (Optional follow-up: websocket Upgrade probe for `/ws`.)

## Files most likely involved (TASK-030)
- `nginx/entrypoint-wrapper.sh`
- `nginx/phone.srve.cc.conf.template`
- `docker-compose.yml` (nginx service only)

## Exact next safe step
Close TASK-030 as complete enough and keep the optional `/ws` websocket Upgrade probe as a separate follow-up only if needed.