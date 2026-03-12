# Kamailio DNS / IP / ACL Refactor (Env-Driven)

This document describes the refactor work done to remove hardcoded DNS names, IP addresses, and allowlists from the WebRTC SBC stack and make them configurable via `.env`.

The goal is **plug-and-play deployment** across different FusionPBX environments (single PBX or multi-PBX) by changing only `.env` and re-rendering templates.

## Summary of what changed

- Hardcoded PBX domains (e.g. `fusn01..fusn08.srve.cc`) were removed from Kamailio routing logic.
- Hardcoded public SBC IPs (e.g. `38.242.157.239`) were removed from media handling and SIP header rewriting.
- Trusted IP/domain allowlists were removed from Kamailio config and moved to `.env`.
- `listen ... advertise` was fixed to use **preprocessor constants** (rendered from `.env`) instead of runtime `$env()`.

## Render model

Configuration is driven by:

- `.env` (source of truth)
- `make render` (runs `envsubst` over templates)

Rendered files of note:

- `kamailio/local.cfg` from `kamailio/local.cfg.template`
- `coturn/turnserver.conf` from `coturn/turnserver.conf.template`
- `rtpengine/rtpengine.conf` from `rtpengine/rtpengine.conf.template`
- `nginx/phone.srve.cc.conf` from `nginx/phone.srve.cc.conf.template`
- `www/index.html` from `www/index.html.template`

## Required `.env` keys (core networking)

- `DOMAIN`
  - Public webphone hostname (used by nginx + frontend + Kamailio fallbacks).
- `PUBLIC_IP`
  - Public IP address of this SBC host.
- `PBX_IP`
  - Default FusionPBX SIP domain/realm (used by the webphone as the SIP domain).
- `PBX_PORT`
  - PBX SIP port (typically 5060).

Notes:

- `PBX_IP` is used as a SIP domain/realm in `www/index.html` (`data-sip-domain`).
  - Example: `PBX_IP=testfusn.srve.cc`
  - If you set this to a raw IP (e.g. `185.187.169.29`), FreeSWITCH will challenge with realm `185.187.169.29` and registration/auth may fail if your FusionPBX domain/users are provisioned under `testfusn.srve.cc`.
- The FreeSWITCH server IP is used for trust/ACL checks, and should be added under `TRUSTED_SIP_IP_*` (see below).

## Multi-PBX (domain -> PBX host mapping)

Kamailio route `GET_PBX_FOR_DOMAIN` (in `kamailio/routes/50-domain-map.cfg`) now supports up to 8 explicit mappings:

- `PBX_MAP_1_DOMAIN`, `PBX_MAP_1_HOST`
- `PBX_MAP_2_DOMAIN`, `PBX_MAP_2_HOST`
- ...
- `PBX_MAP_8_DOMAIN`, `PBX_MAP_8_HOST`

Behavior:

- If the incoming SIP request domain matches `PBX_MAP_N_DOMAIN`, Kamailio uses `PBX_MAP_N_HOST` as the PBX target.
- If no mapping matches, it falls back to `PBX_IP`.

This supports your usage pattern:

- Default PBX: users can login as `100360` (no domain) and it routes using `.env PBX_IP`.
- Tenant PBXs: users login as `100360@fusn04.srve.cc`, and Kamailio routes based on the inline SIP domain.

## Trusted SIP sources (ACLs)

Kamailio route `TRUSTED_SIP_SOURCE` now relies on `.env` values:

- Trusted IPs:
  - `TRUSTED_SIP_IP_1..TRUSTED_SIP_IP_8`
- Trusted domains:
  - `TRUSTED_SIP_DOMAIN_1..TRUSTED_SIP_DOMAIN_8`

These replace previously hardcoded infrastructure allowlists.

Notes:

- WebRTC traffic arrives via `ws/wss` and is not subject to the non-WS trust block.
- UDP/TCP SIP traffic on :5060 is subject to the trust policy (unless in-dialog).

FreeSWITCH / FusionPBX IP allowlisting:

- If FreeSWITCH is running at e.g. `testfusn.srve.cc` and resolves to `185.187.169.29`, ensure that IP is included in the trusted list:
  - `TRUSTED_SIP_IP_N=185.187.169.29`

This is required because PBX->SBC legs often target the SBC public IP in the Request-URI (e.g. `sip:EXT@38.242.157.239`), and Kamailio will block non-WS traffic unless the source IP is trusted.

## Public IP handling in Kamailio (advertise / Via)

Problem:

- `listen ... advertise` does **not** support runtime `$env()` substitution.
- Using `$env(KAM_PUBLIC_IP)` in `listen=... advertise ...` can break startup or produce incorrect `Via` values (e.g. `0.0.0.0`).

Fix:

- `kamailio/local.cfg.template` now defines a preprocessor macro:
  - `#!define KAM_PUBLIC_IP "${PUBLIC_IP}"`
- `kamailio/kamailio.cfg` includes `/etc/kamailio/local.cfg` and uses:
  - `alias=KAM_PUBLIC_IP`
  - `listen=... advertise KAM_PUBLIC_IP:...`

This ensures PBX authentication challenges and dialog transactions work correctly.

## Media anchoring / RTPengine public IP

Hardcoded media-address was removed.

- `kamailio/routes/60-media.cfg`
  - `rtpengine_offer` / `rtpengine_answer` now use `$env(KAM_PUBLIC_IP)`.

## TURN / ICE configuration (frontend + coturn)

Frontend:

- TURN host/user/pass are injected via `www/index.html.template` body `data-*` attributes.
- `www/config.js` builds `window.APP_CONFIG` from those `data-*` attributes.
- `www/app/config.js` uses `window.APP_CONFIG` to build ICE servers.

`.env` keys:

- `TURN_HOST`
- `TURN_USER`
- `TURN_PASS`
- `TURN_RELAY_IP` (often equals `PUBLIC_IP`)

coturn:

- `coturn/turnserver.conf.template` is envsubst-rendered and uses:
  - `realm=${DOMAIN}`
  - `server-name=${DOMAIN}`
  - `external-ip=${PUBLIC_IP}/${TURN_RELAY_IP}`

## Docker-compose changes

- Removed hardcoded IPs/domains from `coturn` and `rtpengine` command args.
- Added `PBX_MAP_{1..8}_DOMAIN/HOST` to Kamailio container env.

## Validation checklist

After updating `.env`:

1. `make render`
2. If you changed `.env` values for the Kamailio container, recreate it so the new environment variables are applied:
   - `docker compose up -d --force-recreate kamailio`
3. Restart remaining services as needed:
   - `docker compose restart nginx coturn rtpengine push-server`
3. Verify:
   - Registration works for default PBX user (no `@domain`)
   - Registration works for tenant PBX user (`user@tenant.domain`)
   - Outgoing calls succeed
   - Incoming calls route back to WS client

## Common troubleshooting

- Outgoing call fails before INVITE with ICE errors:
  - Check `TURN_HOST` is a hostname only (no scheme), e.g. `phone.srve.cc`
- PBX auth challenges fail / 500 after 407:
  - Confirm Kamailio is advertising the correct public IP (see `KAM_PUBLIC_IP` in rendered `kamailio/local.cfg`).

- Conference card still shows after setting `CONFERENCE_FEATURE_ENABLED=false`:
  - Run `make render` to regenerate `www/index.html`.
  - Hard refresh the browser (the conference toggle is read from `data-conference-enabled` in `www/index.html`).
