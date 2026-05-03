# WireGuard container (peer/client)

## 1. Purpose
This pattern runs a WireGuard peer/client container.
- It does not run a WireGuard server.
- It does not generate peers.

It also enables a secure pattern for exposing backend admin endpoints **only** over the WireGuard interface, without publishing admin ports and without adding public nginx routes for `/admin`.

It is useful when a project container stack needs private VPN access without changing host networking.

Typical use-case: keep sensitive services bound privately while the public app (for example `app.example.com`) continues to run normally.

All values must come from `.env`.
This private repo intentionally tracks .env for plug-and-play deployment. Do not commit generated/runtime artifacts, WireGuard generated files, live certificates, logs, backups, or temporary lab data.

## 2. Compose service template
Example `docker-compose.yml` service block:

```yaml
  wireguard:
    image: lscr.io/linuxserver/wireguard:latest
    container_name: wireguard
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
    env_file:
      - .env
    volumes:
      - ./docker/wireguard/start.sh:/start.sh:ro
      - wireguard_config:/config
    entrypoint: ["/bin/sh", "/start.sh"]
    healthcheck:
      test: ["CMD-SHELL", "wg show >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10

volumes:
  wireguard_config:
```

Constraints:
- No `network_mode: host`.
- No `privileged: true`.
- No ports for peer/client mode.

## 3. Required compose pattern for the WireGuard container

Key requirements:
- `cap_add: NET_ADMIN`
- named volume `wireguard_config`
- healthcheck based on `wg show`
- no host networking
- no privileged mode
- no public admin ports

If the WireGuard network namespace must reach backend services on `app_net`, attach it to both networks:

```yaml
  wireguard:
    networks:
      - default
      - app_net
```

## 4. `.env` variables
Required:
- `WG_PRIVATE_KEY`
- `WG_PRESHARED_KEY`
- `WG_ADDRESS`
- `WG_ENDPOINT`
- `WG_ALLOWED_IPS`
- `WG_PUBLIC_KEY`

Optional:
- `WG_PERSISTENT_KEEPALIVE`

Example placeholder values (for `.env.example` only):

```dotenv
WG_PRIVATE_KEY=change-me
WG_PRESHARED_KEY=change-me
WG_ADDRESS=10.99.0.2/32
WG_ENDPOINT=wg.example.com:51820
WG_ALLOWED_IPS=10.99.0.0/24
WG_PUBLIC_KEY=change-me
WG_PERSISTENT_KEEPALIVE=25
```

## 5. WireGuard container purpose and behavior

- It is a WireGuard peer/client container, not a WireGuard server.
- It generates `/config/wg_confs/wg0.conf` from `.env`.
- It keeps WireGuard isolated inside Docker.

## 6. `start.sh` explanation
`docker/wireguard/start.sh`:
- Validates required vars.
- Writes `/config/wg_confs/wg0.conf`.
- Sets `chmod 600`.
- `exec`s `/init` (the image init) to bring the interface up using the image’s normal behavior.
- Does not manually edit host routes.
- Does not add iptables rules.

## 7. Safe defaults
- Split tunnel only.
- `WG_ALLOWED_IPS` should be a private subnet like `10.99.0.0/24`.
- Do not use `0.0.0.0/0` unless you intentionally want a full tunnel and test it separately.

## 8. Why `app_net` is required

This matters specifically for the WireGuard-only admin forwarding pattern:

- `admin-wg-forwarder` uses `network_mode: "service:wireguard"`.
- That means it shares the WireGuard container network namespace.
- If `wireguard` is only on the default Docker network, the forwarder cannot resolve services on `app_net`.
- Backend services like `push-server` live on `app_net`.
- Therefore `wireguard` must be attached to both `default` and `app_net`.

## 9. Backend admin forwarding pattern

Final working design:

- `push-server` admin listener binds inside Docker (not publicly).
- Public nginx has no `/admin` route.
- `admin-wg-forwarder` runs with:

```yaml
network_mode: "service:wireguard"
```

It binds nginx to:

```text
${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}
```

It proxies to:

```text
http://push-server:${ADMIN_BIND_PORT}
```

It sets:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto http;
```

## 10. Why the previous dual-homed proxy failed

The earlier “dual-homed proxy container” approach (a normal container attached to `default` + `app_net`) failed for access control:

- A normal dual-homed Docker proxy sees Docker bridge source IPs like `172.x.x.x`, not the real WireGuard peer IP.
- The backend access-control middleware checks `X-Real-IP`.
- Because the proxy passed Docker bridge IPs, the backend returned `403`.
- `network_mode: service:wireguard` fixes this because traffic enters through the WireGuard network namespace and `$remote_addr` is the WireGuard-side address.

## 11. Correct admin URL pattern

Document admin access only as:

```text
http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/provisioning
```

Do not publish this port publicly.

## 12. First test commands
```bash
docker compose config --quiet
docker compose up -d wireguard
docker compose ps wireguard
docker logs wireguard --tail=120
docker exec wireguard wg show
ip route
ping -c 3 1.1.1.1
```

## 13. Validation commands

```bash
docker inspect wireguard --format 'NetworkMode={{.HostConfig.NetworkMode}} Networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{.IPAddress}} {{end}}'
docker exec wireguard sh -lc 'ip -4 addr show dev wg0; ip route; getent hosts push-server || true'
docker exec wireguard sh -lc 'ss -lntp 2>/dev/null | grep "${ADMIN_WG_BIND_PORT}" || true'
docker logs admin-wg-forwarder --tail=120 || true
docker exec wireguard sh -lc 'curl -i --max-time 8 "http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/provisioning" || true'
curl -k -I --max-time 8 "https://${DOMAIN}/admin/provisioning" || true
```

## 14. Expected success results

- wireguard attached to both Docker networks.
- `getent hosts push-server` resolves inside wireguard.
- listener exists on `${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}`.
- private admin URL returns `200`.
- public `/admin/provisioning` returns `404`.

## 15. Controlled runtime procedure

Safe apply order:

```bash
docker compose up -d --no-deps wireguard
docker compose up -d --no-deps --build admin-wg-forwarder
```

Notes:

- Do not restart public nginx or push-server unless their configs changed.
- If WireGuard network attachment changed, a controlled recreate of only wireguard may be required.
- The named volume `wireguard_config` preserves generated config.

## 16. Troubleshooting

- If no listener on admin port: check forwarder logs and DNS resolution from wireguard.
- If `getent hosts push-server` fails: verify wireguard is attached to `app_net`.
- If admin returns `403`: inspect `X-Real-IP` and confirm proxy is using `network_mode: service:wireguard`, not a dual-homed proxy.
- If public admin returns `200`: stop immediately; public nginx is exposing admin and must be fixed.

## 17. Expected success indicators
- Container is healthy.
- `wg show` displays a peer.
- `latest handshake` is present.
- Host default route is unchanged.
- Remote peer can ping the WireGuard address (example: `10.99.0.2`).

## 18. Rollback
```bash
docker compose stop wireguard
docker compose rm -f wireguard
```

## 19. Security notes
- Rotate keys if exposed.
- This private repo intentionally tracks .env for plug-and-play deployment. Do not commit generated/runtime artifacts, WireGuard generated files, live certificates, logs, backups, or temporary lab data.
- Do not commit generated configs.
- Ignore the WireGuard generated volume/data (for example: `wireguard_config` and `data/wireguard/`).
