# 08 — Phase: Multi-Domain and Environment Config
_Derived from actual code and config files. Update when env vars, templates, or domain config changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working (with known hardcoding issues noted below)

---

## Scope of this phase

- `.env` variables and their runtime role
- Template → generated file pipeline
- Multi-PBX domain mapping in Kamailio
- Frontend config injection via `index.html` template
- Hardcoding issues and fix plan

---

## Key files

| File | Role |
|---|---|
| `.env` | Runtime secrets and deployment config (not committed to git) |
| `.env.example` | Template for all required env vars |
| `Makefile` | Runs envsubst to generate all config files from templates |
| `www/index.html.template` | Frontend shell template — injects APP_CONFIG via `data-*` |
| `www/config.js` | Reads `data-*` from `<body>` → `window.APP_CONFIG` |
| `www/app/config.js` | Consumes `window.APP_CONFIG` → ICE servers, codec flags, TURN |
| `kamailio/local.cfg.template` | Kamailio deployment vars template |
| `kamailio/routes/50-domain-map.cfg` | Multi-domain PBX routing (uses generated local.cfg defines) |
| `nginx/site.conf.template` | Nginx reverse proxy template |
| `coturn/turnserver.conf.template` | CoTURN config template |
| `rtpengine/rtpengine.conf.template` | RTPEngine config template |

---

## Environment variables reference

### Core deployment

| Variable | Example | Used in |
|---|---|---|
| `DOMAIN` | `phone.example.com` | Nginx server name, WSS URL |
| `PUBLIC_IP` | `38.242.157.239` | RTPEngine, Kamailio |
| `PBX_IP` | `pbx.example.com` | Primary PBX host |
| `PBX_PORT` | `5060` | Primary PBX SIP port |

### TURN server

| Variable | Example | Used in |
|---|---|---|
| `TURN_HOST` | `turn.example.com` | Browser ICE config (via index.html template) |
| `TURN_USER` | `turnuser` | Browser ICE config |
| `TURN_PASS` | `turnpass` | Browser ICE config |

### RTP media ports

| Variable | Example | Used in |
|---|---|---|
| `RTP_MIN` | `30000` | RTPEngine port range |
| `RTP_MAX` | `31000` | RTPEngine port range |

### Web Push (VAPID)

| Variable | Example | Used in |
|---|---|---|
| `VAPID_PUBLIC_KEY` | `BIIM6y...` | Frontend subscription, push-server |
| `VAPID_PRIVATE_KEY` | `m5N8G5...` | push-server only |
| `VAPID_SUBJECT` | `mailto:admin@...` | push-server |

### Trusted SIP sources (Kamailio ACL)

| Variable | Example | Used in |
|---|---|---|
| `TRUSTED_SIP_IP_1` | `188.34.145.229` | Kamailio trusted source list |
| `TRUSTED_SIP_DOMAIN_1` | `pbx.example.com` | Kamailio trusted domain list |

### Multi-domain PBX mapping

| Variable | Example | Used in |
|---|---|---|
| `PBX_MAP_1_DOMAIN` | `pbx1.example.com` | Kamailio domain map |
| `PBX_MAP_1_HOST` | `pbx1.example.com` | Kamailio routing target |
| `PBX_MAP_2_DOMAIN` | `pbx2.example.com` | (add more as needed) |
| `PBX_MAP_2_HOST` | `pbx2.example.com` | |

### Feature flags

| Variable | Default | Used in |
|---|---|---|
| `CONFERENCE_FEATURE_ENABLED` | `false` | Frontend conference join feature |

---

## Template pipeline

```
.env  ──────────────────────────────────────────────────┐
                                                          │
Makefile: make config                                     │
  envsubst < www/index.html.template → www/index.html    │
  envsubst < kamailio/local.cfg.template → kamailio/local.cfg
  envsubst < coturn/turnserver.conf.template → ...       │
  envsubst < rtpengine/rtpengine.conf.template → ...     │
  envsubst < nginx/site.conf.template → ...             │
                                                          │
Generated output files ◄──────────────────────────────── ┘
(never edit these directly)
```

### Generated file → runtime use

**`www/index.html`** (generated):
```html
<body
  data-sip-domain="${DOMAIN}"
  data-wss-host="${DOMAIN}"
  data-skin="modern-ops"
  data-turn-host="${TURN_HOST}"
  data-turn-user="${TURN_USER}"
  data-turn-pass="${TURN_PASS}"
  data-conference-enabled="${CONFERENCE_FEATURE_ENABLED}">
```

**`www/config.js`** reads these `data-*` attributes on DOM load:
```js
window.APP_CONFIG = {
  sipDomain: body.dataset.sipDomain,
  wssHost: body.dataset.wssHost,
  turnHost: body.dataset.turnHost,
  turnUser: body.dataset.turnUser,
  turnPass: body.dataset.turnPass,
  conferenceEnabled: body.dataset.conferenceEnabled === 'true',
  ...
}
```

**`www/app/config.js`** consumes `window.APP_CONFIG` to build:
- `ICE_SERVERS` array (STUN + TURN URLs with credentials)
- `TURN_HOST`, `TURN_USERNAME`, `TURN_CREDENTIAL`
- `G711_ONLY`, `FORCE_RELAY`, `ICE_TRANSPORT_POLICY`

---

## Multi-domain PBX routing

**File:** `kamailio/routes/50-domain-map.cfg`

Generated `kamailio/local.cfg` defines each domain mapping:
```
#!define PBX_MAP_1_DOMAIN "pbx1.example.com"
#!define PBX_MAP_1_HOST   "pbx1.example.com"
#!define PBX_MAP_2_DOMAIN "pbx2.example.com"
#!define PBX_MAP_2_HOST   "pbx2.example.com"
```

`50-domain-map.cfg` routes each INVITE based on the Request-URI domain:
```
if ($rd == PBX_MAP_1_DOMAIN) → route to PBX_MAP_1_HOST
if ($rd == PBX_MAP_2_DOMAIN) → route to PBX_MAP_2_HOST
...fallback to PBX_IP
```

To add a new domain: add `PBX_MAP_N_DOMAIN` and `PBX_MAP_N_HOST` to `.env`, re-run `make render`, restart Kamailio.

**Alternatively, use the admin UI** at `http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/admin/routing` (WireGuard-only):
1. Edit PBX mappings and trusted IPs in the web form
2. Click Save (writes `routing-config.json`)
3. On the server: `make routing-apply` → reads routing-config.json, updates `.env` PBX_MAP_* and TRUSTED_SIP_* entries, runs `make render`
4. `docker compose restart kamailio`

`routing-config.json` is the authoritative source when using the admin UI. `.env` is updated from it by `make routing-apply`. Secrets (VAPID keys, TURN credentials, etc.) in `.env` are never touched by the routing apply script.

---

## Known hardcoding issues

### 1. Fallback TURN credentials in www/app/config.js

```js
// These should not exist — read from window.APP_CONFIG only
const TURN_HOST = window.APP_CONFIG?.turnHost || "turn.example.com";   // ← hardcoded fallback
const TURN_USERNAME = window.APP_CONFIG?.turnUser || "turnuser";
const TURN_CREDENTIAL = window.APP_CONFIG?.turnPass || "turnpass";
```

**Impact:** In practice, the template always injects the correct values, so the fallbacks never activate in production. But if `window.APP_CONFIG` is missing (e.g., someone opens `www/index.html` without generating it from template), the hardcoded values are used.

**Fix:** Remove the `||` fallback literals; fail loudly if `APP_CONFIG` values are missing.

### 2. Static trusted SIP IPs in Kamailio

Some IP addresses and domain literals remain hardcoded in `kamailio/kamailio.cfg` and `kamailio/routes/*.cfg` rather than being read from env variables.

**Fix:** Move remaining trust entries to `.env` `TRUSTED_SIP_IP_N` / `TRUSTED_SIP_DOMAIN_N` pattern and render via template.

### 3. Push endpoint URL in Kamailio config

`kamailio/kamailio.cfg` has `http://127.0.0.1:3001/api/push/notify` hardcoded.
**Fix:** Move port `3001` (push-server internal port) to `.env` and render via template.

---

## IPv6 readiness note

The server may have a public IPv6 address, but `${DOMAIN}` may currently have **no AAAA DNS record** — only an A record. Nginx listens on both `listen 443 ssl` and `listen [::]:443 ssl` so that when an AAAA record is added, IPv6 clients will connect without further changes.

If you add an AAAA record to DNS, verify CoTURN also serves IPv6 clients (add `listening-ip=::` to the CoTURN template).

## Rules for future changes

1. **Never add domain names, IP addresses, ports, usernames, or passwords to source files.** Always add to `.env` + render via template.
2. **Never edit generated files.** Edit `.template` versions. The generated file will be overwritten on next `make config`.
3. **After any `.env` change:** run `make config` then restart affected containers (`make restart` or targeted `docker-compose restart <service>`).
4. **To add a new PBX domain:** use the admin routing UI (`/admin/routing`) or add `PBX_MAP_N_DOMAIN` + `PBX_MAP_N_HOST` to `.env` directly; run `make render`, restart Kamailio.
5. **VAPID key rotation:** update both keys in `.env`, run `make config`, restart push-server, re-subscribe all clients (old subscriptions will fail with 410 and be auto-removed by push-server).

---

## Debugging

| Symptom | Check |
|---|---|
| Wrong domain used | Check generated `www/index.html` `data-*` values, `window.APP_CONFIG` in browser console |
| TURN credentials wrong | Check generated `index.html` `data-turn-*` values |
| Kamailio not routing to correct PBX | Check generated `local.cfg` defines, `50-domain-map.cfg` logic |
| New PBX domain not routing | `.env` PBX_MAP entry, `make config` run, Kamailio restarted |
| Push notifications broken after VAPID rotation | Old subscriptions (410) auto-cleaned; users must re-subscribe |
| Template not rendering | `envsubst` installed, all required vars in `.env`, `make config` output for errors |
