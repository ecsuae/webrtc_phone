# WireGuard container (peer/client)

## 1. Purpose
This pattern runs a WireGuard peer/client container.
- It does not run a WireGuard server.
- It does not generate peers.

It is useful when a project container stack needs private VPN access without changing host networking.

Typical use-case: keep sensitive services bound privately while the public app (for example `app.example.com`) continues to run normally.

All values must come from `.env`.
`.env` must never be committed.

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

## 3. `.env` variables
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

## 4. `start.sh` explanation
`docker/wireguard/start.sh`:
- Validates required vars.
- Writes `/config/wg_confs/wg0.conf`.
- Sets `chmod 600`.
- `exec`s `/init` (the image init) to bring the interface up using the image’s normal behavior.
- Does not manually edit host routes.
- Does not add iptables rules.

## 5. Safe defaults
- Split tunnel only.
- `WG_ALLOWED_IPS` should be a private subnet like `10.99.0.0/24`.
- Do not use `0.0.0.0/0` unless you intentionally want a full tunnel and test it separately.

## 6. First test commands
```bash
docker compose config --quiet
docker compose up -d wireguard
docker compose ps wireguard
docker logs wireguard --tail=120
docker exec wireguard wg show
ip route
ping -c 3 1.1.1.1
```

## 7. Expected success indicators
- Container is healthy.
- `wg show` displays a peer.
- `latest handshake` is present.
- Host default route is unchanged.
- Remote peer can ping the WireGuard address (example: `10.99.0.2`).

## 8. Rollback
```bash
docker compose stop wireguard
docker compose rm -f wireguard
```

## 9. Security notes
- Rotate keys if exposed.
- Do not commit `.env`.
- Do not commit generated configs.
- Ignore the WireGuard generated volume/data (for example: `wireguard_config` and `data/wireguard/`).
