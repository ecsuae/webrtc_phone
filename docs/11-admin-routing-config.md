# 11 — Admin: Routing Configuration Page
_Derived from actual code. Update when routing config or apply flow changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Implemented

---

## Scope

- WireGuard-only admin page for PBX domain mappings and trusted SIP sources
- `routing-config.json` as the UI-managed authoritative source
- `make routing-apply` apply flow (reads JSON → updates `.env` → renders templates)
- Save/apply separation (no auto-restart)

---

## URL

`http://<wireguard-ip>:<admin-port>/admin/routing`

Access: WireGuard VPN or localhost only — same guard as `/dashboard` and `/diagnostics/errors`.

---

## What the page shows and does

**Read-only section (top):** Currently loaded values from `process.env` — what Kamailio is actually running with right now. Shows: primary PBX IP/port, public IP, domain, active PBX mappings table, active trusted IPs/domains table.

**Edit section:** Editable form seeded from `routing-config.json` (or current env if no saved config yet):
- **PBX Domain Mappings** — domain → host mappings (up to 8); maps incoming SIP `Request-URI` domain to the PBX host Kamailio routes to
- **Trusted SIP IPs** — IPv4 addresses Kamailio trusts as authenticated SIP sources (no challenge)
- **Trusted SIP Domains** — FQDNs treated as trusted SIP sources

**Save button:** Writes form data to `routing-config.json` on the server. Does NOT auto-apply. Shows confirmation with timestamp.

**Apply instructions panel:** Shows exact commands to activate the saved config.

---

## Save/apply flow

```
1. Edit form in browser → click Save
   → POST /admin/routing/config
   → push-server writes routing-config.json

2. SSH to server:
   cd /opt/webrtc-sbc
   make routing-apply
   # Reads routing-config.json, updates .env PBX_MAP_* and TRUSTED_SIP_* entries,
   # runs make render (regenerates kamailio/local.cfg and other templates)

3. docker compose restart kamailio
   # Picks up the new local.cfg
```

**Why save and apply are separate:**
- `routing-config.json` is written by push-server (which runs as a container)
- Applying requires running `make render` and restarting Kamailio — host-level operations
- Keeping them separate prevents accidental config activation and gives operator review time

---

## routing-config.json

**Host path:** `/opt/webrtc-sbc/routing-config.json`
**Container path:** `/app/routing-config.json` (mounted read/write via docker-compose volume)

Format:
```json
{
  "_comment": "Managed by admin UI — do not edit manually. To apply: make routing-apply && docker compose restart kamailio",
  "pbxMappings": [
    { "domain": "<sip-domain>", "host": "<sip-domain>", "label": "PBX 01" }
  ],
  "trustedIps": [
    { "ip": "<trusted-ip>", "label": "Trusted PBX IP" }
  ],
  "trustedDomains": [
    { "domain": "<sip-domain>", "label": "" }
  ],
  "savedAt": "2026-03-28T12:00:00.000Z"
}
```

**Constraints:**
- Maximum 8 entries each for pbxMappings, trustedIps, trustedDomains (matches `.env` slot count)
- Domain format validated (DNS label pattern)
- IP format validated (IPv4 dotted-quad with octet range check)
- `savedAt` is stamped by push-server on each save

---

## make routing-apply

**File:** `scripts/apply-routing-config.py` (Python 3, no external deps)

What it does:
1. Reads `routing-config.json`
2. Generates updated values for `PBX_MAP_1..8_DOMAIN`, `PBX_MAP_1..8_HOST`, `TRUSTED_SIP_IP_1..8`, `TRUSTED_SIP_DOMAIN_1..8`
3. Rewrites `.env` in-place: updates matching key lines, appends any missing keys
4. All other `.env` entries (secrets, ports, domain, VAPID keys, etc.) are preserved untouched
5. Calls `make render` to regenerate `kamailio/local.cfg` and other templates
6. Prints restart instruction

**Usage:**
```bash
make routing-apply
# then:
docker compose restart kamailio
```

---

## Routes and files

| Route | Method | Guard | Description |
|---|---|---|---|
| `/admin/routing` | GET | WireGuard | HTML admin page |
| `/admin/routing/config` | GET | WireGuard | JSON: current env + saved config |
| `/admin/routing/config` | POST | WireGuard | Save routing config to JSON file |

| File | Role |
|---|---|
| `push-server/src/routes/adminRoutes.js` | Express router |
| `push-server/src/services/routingConfig.js` | Read/write routing-config.json; read process.env config; validate |
| `push-server/src/admin/routingPage.js` | HTML page generator |
| `routing-config.json` | Authoritative config source (mounted into push-server) |
| `scripts/apply-routing-config.py` | Applies routing-config.json to .env |
| `Makefile` (routing-apply target) | Calls apply script + make render |

---

## Validation rules

- Domain: DNS label pattern (`[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[...])*`)
- Host: same as domain OR IPv4
- IP: IPv4 dotted-quad, each octet 0–255
- Max 8 entries per list (matches Kamailio template slot count)
- Empty label is allowed

Validation runs in both push-server (`routingConfig.js`) and client-side (browser alerts on blank required fields, but server is authoritative).

---

## What routing-config.json does NOT manage

- `PBX_IP` / `PBX_PORT` (primary PBX fallback) — edit `.env` directly
- `TURN_*`, `VAPID_*`, `DOMAIN`, `PUBLIC_IP` — never touched by routing apply script
- DID-to-extension mappings in `routes/10-incoming.cfg` — still hardcoded; future improvement

---

## Deployment notes

- `routing-config.json` must exist on host before `docker compose up` (created by repo as empty file)
- Push-server must be rebuilt after adding the volume mount: `make rebuild-push`
- The file is writable by the push-server process (container user must have write access)
- If push-server cannot write to the file, `POST /admin/routing/config` returns 500

---

## Debugging

| Symptom | Check |
|---|---|
| `/admin/routing` returns 403 | Not on WireGuard VPN; connect and retry |
| Save returns 400 | Validation errors shown in response; check domain/IP format |
| Save returns 500 | Check push-server logs; likely routing-config.json permission issue |
| `make routing-apply` fails | Python3 installed? routing-config.json exists? .env writable? |
| Kamailio still uses old config after apply | `make render` ran? `docker compose restart kamailio` ran? Check `docker logs kamailio` |
| New mapping not routing correctly | Check generated `kamailio/local.cfg` has correct defines; `make kam-check` |
