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
│  Nginx (nginx/phone.srve.cc.conf)        │
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

---

## Nginx

**Config:** `nginx/phone.srve.cc.conf` (generated from template)

Key proxy rules:

```nginx
# HTTPS + WSS termination
server {
  listen 443 ssl;
  server_name phone.srve.cc;

  # WebSocket upgrade for SIP
  location /ws {
    proxy_pass http://kamailio:5060;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
  }

  # API → push-server
  location /api {
    proxy_pass http://push-server:3131;
  }

  # Frontend SPA
  location / {
    proxy_pass http://www:8080;
  }
}

# Admin dashboard — public internet blocked
# WireGuard-only access at http://10.252.253.15:8081/dashboard
```

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

**Do not remove this middleware.** The dashboard displays device metadata (browser fingerprints, last-seen IPs, extension numbers). It must not be publicly accessible.

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
| Dashboard inaccessible | WireGuard tunnel active, `10.252.253.15:8081/dashboard` |
| Containers not starting | `make config` run with correct `.env`, `docker-compose logs` |
