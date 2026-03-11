# WebRTC-SBC Project Audit Tracker

Date: 2026-03-09
Scope: Full repo structure understanding + env/hardcoded value audit + change tracking baseline

## 1) Architecture Overview

This repository is a Dockerized WebRTC/SIP SBC stack with these major components:

- **Web client** (`www/`)
  - SIP.js browser dialer UI and call state logic
  - Outgoing/incoming call handlers, media/ringback, dual session features
- **Kamailio** (`kamailio/`)
  - SIP routing, registration, dialog relay, domain mapping, media route hooks
- **RTPEngine** (`rtpengine/`)
  - RTP proxy for media anchoring/NAT traversal
- **Coturn** (`coturn/`)
  - TURN/STUN service for WebRTC ICE
- **Nginx** (`nginx/`)
  - Reverse proxy/WS/TLS entrypoint for `phone.srve.cc`
- **Push server** (`push-server/`)
  - Node service for push notifications and dashboard
- **Orchestration**
  - `docker-compose.yml`, `Makefile` for template generation and runtime wiring

## 2) Build/Runtime Model (Docker + env)

- Project is intended to be plug-and-play via Docker containers.
- `.env` is used by compose and template generation paths.
- `Makefile` uses `envsubst` to generate runtime config files from templates:
  - `coturn/turnserver.conf.template -> coturn/turnserver.conf`
  - `rtpengine/rtpengine.conf.template -> rtpengine/rtpengine.conf`
  - `kamailio/local.cfg.template -> kamailio/local.cfg`
  - `nginx/phone.srve.cc.conf.template -> nginx/phone.srve.cc.conf`
  - `www/index.html.template -> www/index.html`

## 3) Env-Driven Findings

### Confirmed env-driven areas
- `docker-compose.yml` references `.env` and injects env vars.
- `Makefile` validates required env vars and runs `envsubst`.
- Template files correctly use placeholders (`${DOMAIN}`, `${PUBLIC_IP}`, `${PBX_IP}`, etc.).
- Kamailio route mapping partially uses `$env(...)` for PBX/domain trust logic.
- Push server uses `process.env` for keys and runtime settings.

### Hardcoded values still present (important)
The project is **not fully .env-only yet**. Hardcoded values remain in active files, including:

- `www/app/config.js`
  - `TURN_USERNAME = "turnuser"`
  - `TURN_CREDENTIAL = "turnpass"`
  - `TURN_HOST = "phone.srve.cc"`
- `www/config.js` (generated snapshot currently containing concrete host/domain values)
- `kamailio/local.cfg`
  - `#!define PBX_IP "testfusn.srve.cc"` (generated output currently concrete)
- `kamailio/kamailio.cfg`
  - explicit trusted static IP list
  - push endpoint `http://127.0.0.1:3001/...`
- `kamailio/routes/*.cfg`
  - fallback hardcoded domains/IP/media-address examples in active route files
- generated config outputs naturally contain concrete values post-template rendering

## 4) Conclusion on Your Question

Question: “Can you confirm all project relies on .env and no hardcoded values are there?”

Answer: **No, cannot fully confirm.**
- The project is **partially env-driven** and Dockerized well.
- But there are still **hardcoded runtime defaults and static literals** in active source/config files.
- To reach strict “no hardcoded values” policy, additional refactoring is required.

## 5) Existing Change Tracking (current task)

Recent functional updates already done for call-failure UX:
- `www/app/log.js`
  - Added reject detail parsing (including Q.850 Reason support)
  - Added SIP code -> user message mapping
- `www/app/outgoing/call.js`
  - Enhanced `onReject` status/log behavior
- `www/app/outgoing/addCall.js`
  - Enhanced secondary call reject status/log behavior
- `TODO.md`
  - Tracks implementation/testing progress

## 6) Next Recommended Work Items (Env-hardening)

1. Move web TURN credentials/host in `www/app/config.js` to generated runtime config from `.env`.
2. Eliminate static fallback domains in Kamailio routes and centralize under env/template inputs.
3. Replace static trusted SIP IP literals with env-driven list exclusively.
4. Keep generated files out of manual editing; enforce template-only updates.
5. Add CI grep guard to block new hardcoded domain/IP literals in tracked source paths.

## 7) Audit Notes

- Some grep output includes docs and vendor/node_modules references; those are informational and not runtime app source concerns.
- This tracker file is created to maintain ongoing audit/change visibility.
