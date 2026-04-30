# 10 — Registration Diagnostics and Error Codes
_Derived from actual code. Update when diagnostic codes or registration flow changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Implemented (frontend step/error codes + admin error page + Kamailio KAM tracing)

---

## Scope

- Registration diagnostics state machine (`regDiag.js`)
- Step codes REG-001 through REG-010
- Error codes REG-E001 through REG-E010
- Diagnostics widget in the login UI (user-safe labels, no tech jargon)
- Shared error catalog (`regDiagCatalog.js` / `diagCatalog.js`)
- Admin error reference page at `/diagnostics/errors` (WireGuard-only)
- Kamailio KAM observability codes (KAM-001–006, KAM-E001–E004 — ✅ implemented)

---

## Why this exists

Registration can fail at many distinct points. Without structured codes, a "Register failed" message gives no information about whether the failure was:
- Local (bad credentials, missing config)
- Network (WSS can't connect, timeout, TLS error)
- Kamailio (WS accepted, REGISTER not forwarded)
- PBX (Kamailio reached PBX, PBX rejected)

The diagnostics system narrows the failure to the specific layer, so LTE/mobile failures can be triaged without server access.

---

## Architecture

```
startPrimaryRegistration()
  │
  ├─ diagInit()        — reset widget, generate Trace ID
  ├─ diagStep("REG-001") ... diagStep("REG-010")   — advance as each step completes
  ├─ diagError("REG-Exxx", detail)                 — set error, stop timers
  ├─ diagStartConnectTimer(20000)                  — fires REG-E003 if no Connected in 20s
  └─ diagStartResponseTimer(30000)                 — fires REG-E005 if no SIP response in 30s

regDiag.js renders → #regDiagWidget
  - Compact bar: amber=in-progress, green=success, red=error
  - Error state shows: "Registration failed" (heading) + "REG-Exxx: short safe label"
  - Progress state shows: user-safe step label (e.g. "Connecting to server...")
  - Expandable detail: step code/label, Trace ID only (no tech detail strings)
  - Widget hidden when idle; auto-clears 3s after REG-010 (success)
  - Technical error detail logged to console.debug only (devtools, not visible in UI)
```

## Frontend display rules

The login page widget **must not** show any of:
- Technology names: SIP, Kamailio, WebSocket, WSS, PBX, transport, REGISTER, UA
- Internal error detail strings (e.g. "ECONNREFUSED", "no WSS Connected event")
- Server configuration values or hostnames

What is shown:
- In error state: `Registration failed` heading + `REG-Exxx: shortLabel`
- In progress state: user-safe step label from `STEP_LABELS` in `regDiagCatalog.js`
- Expanded section: current step code/label + Trace ID

Full technical detail is available only at the admin error page (WireGuard-only).

## Admin error page

**URL:** `http://10.252.253.15:8081/diagnostics/errors`
**Access:** WireGuard VPN or localhost only — same guard as `/dashboard`
**Route:** `GET /diagnostics/errors` in `push-server/src/routes/diagRoutes.js`
**Bind:** push-server admin listener on `ADMIN_BIND_HOST:ADMIN_BIND_PORT` (default `10.252.253.15:8081`) — configured in `.env` and passed via docker-compose

Shows all REG-E codes with: short label, long technical description, likely failing layer, common causes, recommended checks. Also links back to `/dashboard`.

## Shared catalog

Two files mirror the same catalog data:

| File | Format | Used by |
|---|---|---|
| `www/app/registration/regDiagCatalog.js` | ES module (`export`) | Frontend `regDiag.js` |
| `push-server/src/diagCatalog.js` | CommonJS (`require`) | Admin page `diagPage.js` |

**Keep both in sync** when adding or changing codes. The frontend uses only `shortLabel`. The backend admin page uses all fields (`longDescription`, `likelyLayer`, `commonCauses`, `recommendedChecks`).

---

## Step codes

| Code | Label | Wired at |
|---|---|---|
| REG-001 | Config loaded | Top of `startPrimaryRegistration` — verifies `window.SIP` present |
| REG-002 | Input validated | After `if (!ext || !domain || !pass)` check passes |
| REG-003 | WSS URL resolved | After `normalizeWssServer()` (immediately after REG-002) |
| REG-004 | UA created | After `buildUserAgent()` returns non-null |
| REG-005 | Transport connecting | Before `st.ua.start()` — also starts connect timer |
| REG-006 | Transport connected | In transport state listener on `"Connected"` event |
| REG-007 | REGISTER sent | After `st.reg.register()` — also starts response timer |
| REG-008 | Auth challenge received | Not wired — SIP.js handles 401→retry internally; no hook |
| REG-009 | Authenticated REGISTER sent | Not wired — same reason as REG-008 |
| REG-010 | Registered | In `onAccept` delegate of `Registerer` |

**Note on REG-008/009:** SIP.js handles the 401 Digest challenge cycle internally. There is no supported hook to intercept the challenge or the re-sent REGISTER. These codes exist for server-side logging (see KAM-004/005 below) but are not emitted by the frontend.

---

## Error codes

| Code | Label | When emitted |
|---|---|---|
| REG-E001 | Invalid or missing credentials | `ext`, `domain`, or `pass` empty; or SIP URI construction fails |
| REG-E002 | SIP config missing | `window.SIP` not found at function entry |
| REG-E003 | WSS connection timeout | Connect timer fires (20s) while still at REG-005; or `ua.start()` throws with generic error |
| REG-E004 | WSS closed unexpectedly | Transport state "Disconnected" while `st.registered === false` |
| REG-E005 | No SIP response | Response timer fires (30s) while at REG-007; or `st.reg.register()` throws |
| REG-E006 | Authentication rejected | `onReject` fires with 4xx status code |
| REG-E007 | Host unreachable | `ua.start()` catch — error message contains "dns", "getaddr", "enotfound" |
| REG-E008 | TLS / certificate error | `ua.start()` catch — error message contains "tls", "cert", "ssl", "handshake" |
| REG-E009 | PBX forwarding failure | `onReject` fires with 5xx status code |
| REG-E010 | Frontend state sync error | Reserved; was intended for onAccept-but-registered-flag-not-set scenario |

---

## Trace ID

Each `diagInit()` call generates a random 6-digit hex trace ID in format `T-XXXXXX` (e.g. `T-3FA21B`). This is displayed in the expanded diagnostics widget. When users report issues, they should include this ID. Future server-side logging can correlate with this value if passed as a SIP header or query param.

---

## UI widget behavior

- Widget is hidden (`display:none`) when idle and after successful registration
- On `diagInit()`: widget appears, shows amber dot + first step
- On error: dot turns red, error code and human message shown
- On REG-010 (success): dot turns green, auto-clears after 3s if still registered
- Expand button (`▾`/`▴`) toggles detail section: full step line, error detail, Trace ID
- Widget rendered by `regDiag.js` `_render()` — pure DOM manipulation, no framework

---

## Files

| File | Role |
|---|---|
| `www/app/registration/regDiag.js` | Diagnostics state machine + widget renderer |
| `www/app/registration/regDiagCatalog.js` | Authoritative catalog — `shortLabel`, `longDescription`, `STEP_LABELS` |
| `www/app/registration/primary.js` | Wires `diagStep()` / `diagError()` calls into registration flow |
| `www/app/layout/registrationSection.js` | Contains `<div id="regDiagWidget">` placeholder |
| `www/styles/forms-buttons.css` | `.diag-*` CSS classes |
| `push-server/src/diagCatalog.js` | CommonJS mirror of catalog for admin page |
| `push-server/src/routes/diagRoutes.js` | `GET /diagnostics/errors` (WireGuard-only) |
| `push-server/src/dashboard/diagPage.js` | HTML page generator for admin error reference |

---

## Kamailio KAM server-side tracing — ✅ Implemented

These codes are live in Kamailio. Every REGISTER attempt from a WebSocket client produces a trace sequence in `docker logs kamailio`. See [07-phase-kamailio-rtpengine-nginx.md](07-phase-kamailio-rtpengine-nginx.md) for full grep commands and LTE failure patterns.

### KAM step codes

| Code | Label | File | Location |
|---|---|---|---|
| KAM-001 | WS-ACCEPTED | `kamailio.cfg` | `event_route[xhttp:request]` after `ws_handle_handshake()` succeeds |
| KAM-002 | REG-RECEIVED | `routes/20-registration.cfg` | Start of `route[HANDLE_REGISTER]` — initial REGISTER (no Authorization header) |
| KAM-003 | REG-FORWARDED | `routes/20-registration.cfg` | `route[RELAY_REGISTER_TO_PBX]` before `route(RELAY)` — initial forward only |
| KAM-004 | REG-401-CHALLENGE | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs == 401` |
| KAM-005 | REG-AUTH-FORWARDED | `routes/20-registration.cfg` | Start of `route[HANDLE_REGISTER]` — authenticated re-send (Authorization header present) |
| KAM-006 | REG-200-OK | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs =~ "2[0-9][0-9]"` |

### KAM error codes

| Code | Label | File | Location |
|---|---|---|---|
| KAM-E001 | WS-UPGRADE-FAILED | `kamailio.cfg` | `event_route[xhttp:request]` when `ws_handle_handshake()` fails |
| KAM-E002 | REG-REJECTED-LOCAL | `routes/20-registration.cfg` | `route[RELAY_REGISTER_TO_PBX]` when no PBX host resolved |
| KAM-E003 | REG-RELAY-FAILED | `routes/20-registration.cfg` | `failure_route[REGISTER_RELAY_FAILED]` — all branches failed or timed out |
| KAM-E004 | REG-PBX-ERROR | `routes/40-replies.cfg` | `onreply_route[MANAGE_REPLY]` when `$rs =~ "[45][0-9][0-9]"` and not 401 |

### Log fields

Each line includes: `ext=` (From user), `domain=` (From domain), `src=` (source IP:port), `realip=` (actual client IP from `X-Real-IP`, KAM-001 only), `pbx=` (destination URI), `ci=` (SIP Call-ID), `status=`/`reason=` (error codes only).

### Grep commands

```bash
# All KAM trace lines (live follow)
docker logs -f kamailio 2>&1 | grep '\[KAM-'

# Errors only
docker logs kamailio 2>&1 | grep '\[KAM-E'

# Specific extension
docker logs kamailio 2>&1 | grep '\[KAM-' | grep 'ext=100360'
```

### LTE failure patterns

| Pattern | Diagnosis |
|---|---|
| KAM-001 missing | WS upgrade never reached Kamailio — check Nginx `/ws` proxy |
| KAM-001/002/003, no KAM-004 and no KAM-E003 | REGISTER forwarded, PBX silent — most common LTE failure (frontend sees REG-E005) |
| KAM-001/002/003/004, no KAM-005 | 401 relayed back, browser never sent auth re-REGISTER — LTE CGNAT dropped second REGISTER; enable LTE/5G Mode |
| KAM-E004 logged | PBX returned final error — 403=wrong password, 404=extension not found |

### Nginx observability (not yet implemented)

NGX-001/002/003 codes (TLS handshake, WS upgrade, proxy connection) could be added via custom `log_format` and a `$request_id` header threaded from Nginx → browser → Kamailio xlog for end-to-end correlation.

---

## Debugging with diagnostics

| Symptom | Likely code | What to check |
|---|---|---|
| REG-E001 | Input validation | Are all fields populated? Is domain correct? |
| REG-E002 | Page not served correctly | Opening `file://` instead of HTTPS? `www/index.html` not generated from template? |
| REG-E003 | Server unreachable | WSS URL correct? Nginx running? TLS cert valid? Firewall blocking 443? |
| REG-E004 | Network drop during register | Carrier CGNAT dropping TCP? Check LTE/5G Mode. Nginx `proxy_buffering off` in `/ws`? |
| REG-E005 | Kamailio not responding | Kamailio container running? Check `docker logs kamailio`. Port 8443 listening? |
| REG-E006 | Wrong password | Check FusionPBX extension credentials |
| REG-E007 | DNS failure | WSS hostname resolves? Try `nslookup phone.srve.cc` from client device |
| REG-E008 | TLS cert issue | Cert expired? Self-signed? Check browser cert warning if you open the WSS host directly |
| REG-E009 | PBX not reachable from Kamailio | Check PBX_IP / PBX_PORT in generated `local.cfg`. FusionPBX running? |
| REG-E005 + LTE only | LTE-specific failure | Enable LTE/5G Mode (forces TURN relay). Check Nginx `proxy_buffering off` |
