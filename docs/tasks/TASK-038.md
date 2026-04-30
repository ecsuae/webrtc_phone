# TASK-038 — Standalone plug-and-play deployment (mobi.srve.cc) — WireGuard + Let’s Encrypt

## Status
In Progress

## Context
We are preparing a fresh-VPS, docker-first deployment workflow for the new VPS domain `mobi.srve.cc`.

Target operator workflow:
- `git clone`
- `cp .env.example .env`
- edit `.env`
- `docker compose up -d --build`

Critical constraints:
- Work ONLY on the new VPS for `mobi.srve.cc`.
- Do NOT touch old production VPS `phone.srve.cc`.
- No hardcoded deployment-specific domains/IPs/ports in repo-owned configs.
- Admin endpoints must not become publicly exposed.

## Current baseline
- Branch: `callcontrol`
- `https://mobi.srve.cc` loads, but browser reports certificate issues.
- TLS certs are currently assumed to exist under `./certs` (no docker-based ACME issuance/renewal yet).
- Admin bind currently must remain safe: `ADMIN_BIND_HOST=127.0.0.1` (not public) until WireGuard is verified.

WireGuard status:
- WireGuard peer/client container started and verified healthy (healthcheck OK, handshake present).
- Host default route remained normal; route changes were isolated to the container.
- TLS mismatch remains separate and will be handled in the Let’s Encrypt step.

## Scope
- Dockerized WireGuard VPN service controlled by `.env`.
- Docker-based Let’s Encrypt / certbot (or ACME client) with auto-renewal.
- Ensure all deployment-specific values come from `.env`.
- Automatic runtime config rendering from `.env` during container startup.
- Produce a clean first-run procedure for the new VPS.

## Out of scope
- Any runtime changes on old production `phone.srve.cc`.
- Broad SIP/media refactors not required for portability.
- Reapplying large historical change-sets wholesale.

## Safety rules
- No `git reset`, no `git clean`, no force checkout.
- Do not merge/cherry-pick entire backup refs.
- Apply changes in small, reviewable steps with explicit diffs.
- Do not start containers / restart services without explicit approval.
- Never commit real secrets from `.env`.

WireGuard implementation note:
- The WireGuard container is a peer/client (not a WireGuard server).
- Dedicated documentation: `docs/wireguard-container.md`.

## Deployment-specific values (new VPS)
- `DOMAIN=mobi.srve.cc`
- `PUBLIC_IP=188.34.145.231`
- `TURN_HOST=mobi.srve.cc`
- `TURN_RELAY_IP=188.34.145.231`
- `ADMIN_BIND_HOST=127.0.0.1` (for now)
- `ADMIN_BIND_PORT=8081`

## Step plan (incremental)
1. WireGuard container (disabled-by-default until env is set)
   - Add `wireguard` service to `docker-compose.yml`.
   - Add WireGuard variables to `.env.example` with safe placeholders.
   - Keep admin listener on localhost (`ADMIN_BIND_HOST=127.0.0.1`).
   - Document how we will later move admin behind WireGuard by changing `ADMIN_BIND_HOST` to a WireGuard interface IP (after WG is verified).

2. Let’s Encrypt / ACME in Docker with auto-renewal
   - Add a docker-based ACME client (certbot or alternative) that:
     - issues certs for `${DOMAIN}`
     - renews automatically
     - exposes HTTP 80 for ACME challenges
   - Ensure nginx uses the issued certs via a shared volume.
   - Ensure renew triggers nginx reload without breaking WS proxying.

3. Remove remaining hardcoded deployment values
   - Replace any hardcoded domains/IPs/ports with `.env` variables.
   - Ensure generated configs are created from templates automatically.

4. “Fresh VPS boot” verification
   - Confirm the exact operator command sequence works from a clean clone.

## Verification checklist
- WireGuard:
  - WireGuard container starts and generates peer config(s) in a persistent volume.
  - UDP port is correct and controlled by `.env`.
  - Admin stays unreachable from public internet while `ADMIN_BIND_HOST=127.0.0.1`.
  - After WG verification, admin can be moved behind WG by binding to WG IP (explicitly documented).

- Certificates:
  - HTTP 80 serves ACME challenge.
  - HTTPS 443 serves the correct cert for `${DOMAIN}`.
  - Auto-renew runs and nginx reloads cleanly.
  - WebSocket proxying remains intact.

- Portability:
  - No hardcoded `phone.srve.cc` or `38.242.157.239` or other old prod values in repo-owned config.
  - `.env.example` contains placeholders only.

## Rollback notes
- Each step must be revertible by reverting the small commit(s) for that step.
- Avoid coupled changes across multiple services in a single step.

## Known risks
- Introducing VPN changes can affect routing; keep admin bound to localhost until WG is proven.
- ACME/LE changes can break nginx startup if certs are missing; must ensure safe first-boot behavior.
- Changing compose networking (host vs bridge) is high-risk; avoid large networking shifts.

## Notes from `not-working` tag inspection
- `not-working` (`899887d`) was inspected read-only.
- It does NOT contain WireGuard container work.
- It does NOT contain Docker-based Let’s Encrypt/certbot automation.
- It includes static certificate assumptions (`certs/fullchain.pem`, `certs/privkey.pem`) and old production values (`DOMAIN=phone.srve.cc`, `PUBLIC_IP=38.242.157.239`), so it must NOT be restored wholesale.
- WireGuard and Let’s Encrypt automation must be implemented fresh, step-by-step, from the current good baseline.
