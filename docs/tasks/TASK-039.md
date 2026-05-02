# TASK-039 — WireGuard-only backend admin (Docker-only, no host firewall)

## Goal
Provide backend admin access (push-server admin UI and APIs) **only** over WireGuard, while keeping the deployment Docker-only.

## Requirements
- Admin must not be exposed on public host interfaces.
- Do not use host iptables.
- Do not expose `/admin` through public nginx.
- Do not bind admin to the Docker bridge gateway (e.g. `172.18.0.1`) as a final solution.
- Keep runtime stable until the migration is implemented and tested.
- Use `.env` / `.env.example` for all configurable values (domains, IPs, ports).
- Keep changes isolated and reviewable.

## Current state (risk drivers)
- `push-server` is `network_mode: host`.
- `nginx` is `network_mode: host`.
- Nginx reaches:
  - Push API via `http://127.0.0.1:${PUSH_SERVER_PORT}`.
  - Kamailio WS via `http://127.0.0.1:${KAMAILIO_WS_PORT}`.
- `push-server` admin is currently bound to `127.0.0.1:${ADMIN_BIND_PORT}`.
- The WireGuard interface IP exists inside the `wireguard` container namespace (`wg0`), not on the host.

## Likely target design
- **nginx** on bridge networking with env-driven published ports:
  - `${HTTP_PORT}:80`
  - `${HTTPS_PORT}:443`
- **push-server** on a private Docker app network:
  - no published ports
  - public API listener inside container: `PUSH_LISTEN_HOST=0.0.0.0`, `PUSH_SERVER_PORT`
  - admin listener inside container: `ADMIN_BIND_HOST=0.0.0.0`, `ADMIN_BIND_PORT`
  - safe because no ports are published and nginx will not proxy `/admin`
- **nginx upstreams** use Docker DNS names:
  - `http://push-server:${PUSH_SERVER_PORT}`
  - `http://kamailio:${KAMAILIO_WS_PORT}` (if Kamailio migrates)
- **wireguard** remains a Docker container and is attached to the private app network.
- **admin-wg-proxy** shares the wireguard network namespace (`network_mode: service:wireguard`) and:
  - listens on `wg0` IP/port from `.env`
  - forwards to `push-server` admin over the private app network
- Kamailio WS reachability must be explicitly handled if nginx leaves host networking.

## Risks
- Moving nginx off host networking changes:
  - reachability of Kamailio WS and push-server API
  - WebSocket proxying behavior (registration/keepalives)
- Changing Kamailio networking can affect SIP routing and registrations.
- A `network_mode: service:wireguard` proxy cannot attach to additional networks directly; path to upstream must be validated.

## Implementation stages
### Stage A — Read-only mapping
- Map current nginx upstreams and all host-exposed ports.
- Confirm which services depend on host loopback reachability.
- Confirm Kamailio WS bind and how it is exposed to nginx.

### Stage B — Network scaffolding (no behavior change)
- Add a private `app_net` network (internal).
- Attach candidates to `app_net` in a way that does not change runtime behavior.
- Validate DNS and routing assumptions in containers.

### Stage C — Migrate push-server + nginx
- Move push-server off host net onto `app_net` with no published ports.
- Move nginx off host net; publish only `${HTTP_PORT}`/`${HTTPS_PORT}`.
- Update nginx template upstreams to Docker DNS names.
- Verify public site + `/api/` while keeping `/admin` unexposed.

### Stage D — WireGuard-only admin proxy
- Attach wireguard to `app_net`.
- Add `admin-wg-proxy` in the wireguard netns.
- Confirm the proxy can reach push-server admin without exposing it publicly.

### Stage E — Verification
- Public:
  - site loads over HTTPS
  - `/api/health` works
  - `/ws` registration works and stays stable
- Admin:
  - reachable only from a WireGuard client
  - not reachable from public internet
  - not reachable via public nginx

## Rollback plan
- Keep a minimal rollback path that restores prior host networking:
  - revert compose networking changes
  - revert nginx upstreams back to loopback
  - restart only affected containers (`nginx`, `push-server`, and any migrated service)
- Maintain a clear test checklist so rollback decision can be made quickly.
