# 07 — Phase: Kamailio, RTPEngine, Nginx
_Derived from actual config files and codebase. Update when infrastructure or SIP proxy logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working

---

## Scope of this phase

- Kamailio SIP proxy role, route files, and key behaviors
- RTPEngine media bridging (WebRTC SRTP ↔ SIP RTP)
- Nginx WSS/HTTPS termination
- CoTURN STUN/TURN service
- Container orchestration (Docker + Makefile)
- Admin security (WireGuard-only dashboard/admin)
- Push trigger from Kamailio to push-server

---

## Component roles

```
Browser (WSS/HTTPS)
    │
    ▼
┌─────────────────────────────────────────┐
│  Nginx (nginx/site.conf.template)        │
│  - HTTPS termination (443)               │
│  - WSS upgrade → Kamailio (5060)         │
│  - /ws path → Kamailio websocket port    │
│  - / path → www Express app              │
│  - /api → push-server (3131)             │
└─────────────────────────────────────────┘
    │ SIP/WSS
    ▼
┌─────────────────────────────────────────┐
│  Kamailio (kamailio/kamailio.cfg)        │
│  - Receives WSS SIP from browser         │
│  - REGISTER relay + digest auth          │
│  - INVITE routing + domain mapping       │
│  - RTPEngine offer/answer hooks          │
│  - Push notify trigger (offline clients) │
└─────────────────────────────────────────┘
    │ SIP/UDP          │ UDP control
    ▼                  ▼
┌────────────────┐  ┌──────────────────────┐
│  FusionPBX/    │  │  RTPEngine           │
│  FreeSWITCH    │  │  - WebRTC↔SIP media  │
│  (PBX_IP)      │  │  - SRTP/RTP bridge   │
│                │  │  - NAT traversal     │
└────────────────┘  └──────────────────────┘
                           │ media
                           ▼
                    ┌──────────────┐
                    │  CoTURN      │
                    │  STUN/TURN   │
                    └──────────────┘
```

---

## Kamailio

### Main config file

`kamailio/kamailio.cfg` — entry point. Includes:
- Module loading (websocket, tls, rtpengine, nathelper, etc.)
- Static trusted IP list (**known issue**: some still hardcoded — see §08 and `01-current-state-and-handoff.md`)
- Push endpoint: `http://127.0.0.1:3001/api/push/notify`
- Includes `local.cfg` (generated from template)
- Includes route files from `kamailio/routes/`

### Route files

| File | Role |
|---|---|
| `routes/10-incoming.cfg` | Incoming call routing decisions (offline → push, online → deliver) |
| `routes/11-outgoing.cfg` | Outgoing call routing to PBX |
| `routes/30-dialog-relay.cfg` | Dialog relay; in-dialog re-INVITE handling (hold/unhold, RTPEngine update) |
| `routes/50-domain-map.cfg` | Multi-domain PBX mapping (`PBX_MAP_N_DOMAIN` → `PBX_MAP_N_HOST`) |
| `routes/60-media.cfg` | RTPEngine offer/answer integration for each call leg |

### REGISTER flow

```
Browser → REGISTER (WSS)
  Kamailio:
    → forward REGISTER to FusionPBX (PBX_IP:PBX_PORT)
    ← 401 Unauthorized (challenge)
  Browser → REGISTER with Authorization header
  Kamailio:
    → forward to FusionPBX
    ← 200 OK
  Kamailio:
    → 200 OK to browser
  st.registered = true, setRegistrationComplete()
```

### Incoming call routing (online client)

```
FusionPBX → INVITE to phone.domain.com (WSS client)
  Kamailio:
    routes/10-incoming.cfg:
      → is browser registered? (check usrloc)
      → YES: RTPEngine offer, relay INVITE to browser
      → NO:  trigger push (see below)
```

### Incoming call — offline push trigger

```
Kamailio routes/10-incoming.cfg:
  Client not in usrloc (offline):
    → HTTP POST http://127.0.0.1:3001/api/push/notify
      body: { extension, payload: { from, callId, ... } }
    → push-server sends Web Push to browser's service worker
    → SW wakes client, client re-registers, Kamailio retries INVITE
```

### Hold/unhold in-dialog handling

`routes/30-dialog-relay.cfg` handles re-INVITEs within an established dialog:
- Intercepts re-INVITE
- Calls RTPEngine to update the media path for the new SDP direction
- Relays updated SDP to both legs

**If this file is misconfigured, hold/unhold silently fails** — RTPEngine doesn't update, media stops.

---

## RTPEngine

**Config:** `rtpengine/rtpengine.conf` (generated from template)

RTPEngine bridges WebRTC SRTP (browser side) to plain RTP (PBX side). It is called by Kamailio via `rtpengine_manage()` on each INVITE and re-INVITE.

**Responsibilities:**
- Decrypt SRTP from browser, re-encrypt or forward plain RTP to PBX
- NAT traversal (rewriting SDP `c=` and port lines)
- Codec pass-through (G.711 both sides — no transcoding needed)
- RTP media relay on UDP ports `RTP_MIN`–`RTP_MAX` (from `.env`)

**If RTPEngine is down:** all calls will fail at media level (SDP negotiation succeeds, but no audio).

**`media-address` in PBX→WebRTC paths — do not add:**

RTPEngine is configured with `--interface=eth0!${PUBLIC_IP}` in `docker-compose.yml`, which already makes it advertise the correct public IP in all ICE candidates. No `media-address` flag is needed in `60-media.cfg` for these paths.

Adding `media-address=$env(KAM_PUBLIC_IP)` to the PBX→WebRTC `else` branches caused asymmetric audio on Wi-Fi and was reverted. See `docs/05` for the full warning.

**`rtcp-mux=answer` and `codec-mask` in MEDIA_ANSWER else — do not add:**

The MEDIA_ANSWER else branch (PBX→WebRTC, outgoing call answer) must use only:
`RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive`

Adding `rtcp-mux=answer` or `codec-mask=PCMA codec-mask=PCMU` to this branch causes asymmetric audio (one-sided) on Wi-Fi. The OFFER path uses `ICE=remove` which does not initialize rtcp-mux state, so specifying `rtcp-mux=answer` in the subsequent ANSWER creates a mismatched session state in RTPEngine. Confirmed broken and reverted 2026-03-29.

---

## Nginx

**Config:** `nginx/site.conf` (rendered from template)

Key proxy rules:

```nginx
# HTTPS + WSS termination — IPv4 and IPv6
server {
  listen 443 ssl;
  listen [::]:443 ssl;   # IPv6 — required when AAAA DNS record is added
  server_name ${DOMAIN};

  # WebSocket upgrade for SIP
  # proxy_buffering off is critical: ensures Kamailio ping/pong frames are
  # forwarded immediately. Without it, LTE carrier CGNAT can silently drop
  # the TCP session when keepalive frames are delayed in nginx's output buffer.
  location /ws {
    proxy_pass http://127.0.0.1:8443;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
    proxy_buffering off;
  }

  # API → push-server
  location /api/ {
    proxy_pass http://127.0.0.1:3001;
  }

  # Frontend SPA
  location / {
    try_files $uri $uri/ =404;
  }
}

# Admin dashboard — public internet blocked
# WireGuard-only access at http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/dashboard
```

**Do not remove `proxy_buffering off` from `/ws`.** It is required for WebSocket keepalive reliability on mobile/LTE networks.

---

## CoTURN

**Config:** `coturn/turnserver.conf` (generated from template)

| Service | Port | Protocol |
|---|---|---|
| STUN | 3478 | UDP |
| TURN | 3478 | UDP + TCP |
| TURNS (TLS) | 5349 | TCP |

Credentials: `TURN_USER` / `TURN_PASS` from `.env`. The browser ICE configuration uses these via `window.APP_CONFIG`.

---

## Docker + Makefile

### Containers (docker-compose.yml)

| Container | Image | Role |
|---|---|---|
| `www` | nginx/node | Serves frontend SPA |
| `push-server` | node | Push notification + admin API |
| `kamailio` | kamailio | SIP proxy |
| `rtpengine` | rtpengine | WebRTC-SIP media bridge |
| `coturn` | coturn | STUN/TURN |
| `nginx` | nginx | Public reverse proxy (443) |

### Makefile targets

```makefile
make config    # Run envsubst on all templates → generate runtime configs
make up        # docker-compose up -d (after config)
make down      # docker-compose down
make restart   # down + config + up
make logs      # tail all container logs
```

Always run `make config` before `make up` when `.env` changes.

---

## Admin security — WireGuard guard

**File:** `push-server/src/middleware/accessControl.js`

Middleware checks client IP on admin routes:
- Allowed: `10.252.253.x` (WireGuard subnet) and `127.0.0.1` (localhost)
- Blocked: all other IPs (internet traffic)

**Protected endpoints:**
- `GET /dashboard`
- `GET /api/logs/mobile` and sub-paths
- `PATCH /api/logs/mobile/:deviceId/comment`
- `GET /diagnostics/errors`

**Do not remove this middleware.** The dashboard displays device metadata (browser fingerprints, last-seen IPs, extension numbers). It must not be publicly accessible.

## Admin listener — port 8081 on WireGuard interface

Push-server starts **two** Express listeners:

| Listener | Bind address | Purpose |
|---|---|---|
| Main | `127.0.0.1:3001` | Public API — Nginx proxies `/api/` here |
| Admin | `${ADMIN_BIND_HOST}:${ADMIN_BIND_PORT}` | WireGuard-only — dashboard + diagnostics |

The admin listener is the same Express app. Admin routes already require `requireWireGuardAccess`; the separate port adds network-layer isolation (Nginx never touches port 8081).

**Configured by** (in `.env`):
- `ADMIN_BIND_HOST` — push-server admin bind address
- `ADMIN_BIND_PORT` — push-server admin bind port

Both are passed into the container via `docker-compose.yml` environment block.

**Admin URLs** (connect via WireGuard first):
- `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/dashboard`
- `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/diagnostics/errors`
- `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/routing`
- `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/calllogs`
- `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/health`

**Restart required** after any change: `docker compose restart push-server`

---

## Registration diagnostics — Kamailio KAM tracing

**Status: ✅ Implemented**

All KAM step and error codes are now live in Kamailio. Every REGISTER attempt from a WebSocket client produces a trace sequence in `docker logs kamailio`.

### Step codes — where they are logged

| Code | Label | File | Location |
|---|---|---|---|
| KAM-001 | WS-ACCEPTED | `kamailio.cfg` | `event_route[xhttp:request]` after `ws_handle_handshake()` succeeds |
| KAM-002 | REG-RECEIVED | `routes/20-registration.cfg` | Start of `route[HANDLE_REGISTER]` — initial REGISTER (no Authorization header) |
| KAM-003 | REG-FORWARDED | `routes/20-registration.cfg` | `route[RELAY_REGISTER_TO_PBX]` before `route(RELAY)` — initial forward only |
| KAM-004 | REG-401-CHALLENGE | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs == 401` |
| KAM-005 | REG-AUTH-FORWARDED | `routes/20-registration.cfg` | Start of `route[HANDLE_REGISTER]` — authenticated re-send (Authorization header present) |
| KAM-006 | REG-200-OK | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs =~ "2[0-9][0-9]"` |

### Error codes — where they are logged

| Code | Label | File | Location |
|---|---|---|---|
| KAM-E001 | WS-UPGRADE-FAILED | `kamailio.cfg` | `event_route[xhttp:request]` when `ws_handle_handshake()` fails |
| KAM-E002 | REG-REJECTED-LOCAL | `routes/20-registration.cfg` | `route[RELAY_REGISTER_TO_PBX]` when no PBX host resolved |
| KAM-E003 | REG-RELAY-FAILED | `routes/20-registration.cfg` | `failure_route[REGISTER_RELAY_FAILED]` — all branches failed or timed out |
| KAM-E004 | REG-PBX-ERROR | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs =~ "[45][0-9][0-9]"` and not 401 |

### Log format

Each line includes fields for correlation and triage:
- `ext=` — SIP extension (From user)
- `domain=` — SIP domain (From domain)
- `src=` — source IP:port (Kamailio sees Nginx upstream as `127.0.0.1`)
- `realip=` — actual client IP from `X-Real-IP` header (KAM-001 only)
- `pbx=` — PBX destination URI
- `ci=` — SIP Call-ID (correlates with frontend Trace ID)
- `status=` / `reason=` — SIP response code and phrase (error codes only)

### Grep commands

```bash
# All KAM trace lines (live follow)
docker logs -f kamailio 2>&1 | grep '\[KAM-'

# All KAM lines for a specific extension
docker logs kamailio 2>&1 | grep '\[KAM-' | grep 'ext=100360'

# All KAM lines for a specific Call-ID
docker logs kamailio 2>&1 | grep '\[KAM-' | grep 'ci=abc123@'

# Errors only
docker logs kamailio 2>&1 | grep '\[KAM-E'

# Full registration trace (last 200 lines, filtered)
docker logs kamailio --tail=200 2>&1 | grep -E '\[KAM-|REGISTER|MANAGE_REPLY'
```

### LTE failure patterns

| Pattern (codes seen) | Diagnosis | Action |
|---|---|---|
| KAM-001 missing | WS upgrade never reached Kamailio | Check Nginx `/ws` proxy, TLS cert, port 8443 |
| KAM-001 only (no KAM-002) | WS connected, REGISTER never arrived at Kamailio | Check `request_route` ACL, SIP.js transport |
| KAM-001 + KAM-002, no KAM-003 | REGISTER received but domain map failed | Check `GET_PBX_FOR_DOMAIN`, PBX_IP in `.env`, `make config` run |
| KAM-001/002/003, no KAM-004 and no KAM-E003 | **REGISTER forwarded, PBX silent** — most common LTE failure; frontend sees REG-E005 | Check PBX UDP reachability, `docker logs` FusionPBX, SIP firewall, PBX_IP/PORT |
| KAM-E003 logged | Relay failed immediately (ICMP error, connection refused) | PBX_PORT wrong, UDP not listening, network path broken |
| KAM-001/002/003/004, no KAM-005 | 401 relayed back, browser never sent auth re-REGISTER | LTE CGNAT dropped the second REGISTER — enable LTE/5G Mode |
| KAM-001/002/003/004/005, no KAM-006 | Auth REGISTER forwarded, PBX never replied | PBX stalled; check FusionPBX logs for auth processing |
| KAM-E004 logged | PBX returned final error (403/404/5xx) | Check status code: 403=wrong password, 404=extension not found, 5xx=PBX error |

### Admin error page

---

## Debugging

| Symptom | Check |
|---|---|
| WSS connection fails | Nginx `/ws` proxy config, TLS certs, Kamailio websocket port |
| Registration auth fails | Kamailio `local.cfg` PBX_IP/PORT, FusionPBX extension config |
| Incoming call not delivered (online) | `routes/10-incoming.cfg` usrloc lookup, RTPEngine availability |
| Incoming call not delivered (offline) | Push trigger `http://127.0.0.1:3001/api/push/notify`, push-server logs |
| No audio | RTPEngine logs, RTP port range firewall rules, TURN credentials |
| Hold/unhold fails silently | `routes/30-dialog-relay.cfg`, RTPEngine in-dialog update |
| Conference transfer fails | `routes/11-outgoing.cfg`, FusionPBX attended transfer config |
| Dashboard inaccessible | WireGuard tunnel active, `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/dashboard` |
| Containers not starting | `make config` run with correct `.env`, `docker-compose logs` |
