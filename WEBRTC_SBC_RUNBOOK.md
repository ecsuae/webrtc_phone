# WebRTC SBC Runbook (Current Working Setup)

Last updated: 2026-02-28

This document explains the **currently working** setup for this repository and how to troubleshoot registration/media issues quickly.

---

## 1) High-level call flow

1. Browser SIP.js client connects to `wss://phone.srve.cc/ws`
2. Nginx terminates TLS (443) and proxies `/ws` to Kamailio on `tcp/8443`
3. Kamailio handles SIP over WebSocket, then relays signaling to PBX over **UDP/5060**
4. RTP/media is anchored by RTPengine
5. TURN/STUN is served by Coturn for WebRTC ICE candidates

---

## 2) File map and what each file does

## Core orchestration

### `docker-compose.yml`
Defines active runtime containers and network/ports.

Important current values:
- `kamailio`:
  - `network_mode: host`
  - environment includes:
    - `PBX_IP=${PBX_IP}`
    - `PBX_PORT=${PBX_PORT}`
    - `PBX_TRANSPORT=udp`
- `nginx`:
  - publishes `80:80`, `443:443`
- `rtpengine`:
  - control port `2223/udp`
  - media ports `30000-31000/udp`
- `coturn`:
  - host network mode
  - listening on `3478` and `5349`

Notes:
- Kamailio and Coturn are host-networked.
- `webrtc` network is external for container-to-container components that use bridge networking.

---

## SIP signaling proxy (Kamailio)

### `kamailio/kamailio.cfg` (ACTIVE)
Main SIP routing logic.

Critical behavior in current working config:
- WebSocket handshake handled in `event_route[xhttp:request]` on port `8443`
- WS SIP requests enter `request_route`
- REGISTER requests:
  - run NAT/register helper route
  - add RFC3327 Path header
  - relay to PBX via route `RELAY_TO_PBX`
- Relay destination built from env:
  - `PBX_IP`, `PBX_PORT`, `PBX_TRANSPORT`
- For UDP-only PBX compatibility, before relay (for WS/WSS clients):
  - Via transport is normalized to UDP:
    - `SIP/2.0/WSS` or `SIP/2.0/WS` -> `SIP/2.0/UDP`
  - For REGISTER, Contact is normalized:
    - remove `;transport=ws`
    - remove `;alias=...`

Media routes:
- `MEDIA_OFFER`, `MEDIA_ANSWER`, `MEDIA_DELETE` use RTPengine.

### `kamailio/local.cfg` (rendered/static helper)
Contains PBX and RTPengine definitions.
Current file has:
- `PBX_IP "85.235.64.159"`
- `PBX_PORT "5060"`
- `RTPENGINE_SOCK "udp:rtpengine:22222"`

Important:
- Current live Kamailio relay uses env variables from docker-compose (`PBX_IP=${PBX_IP}`), not these `#!define` values in practice unless included in cfg logic.

### `kamailio/local.cfg.template`
Template used by render scripts/Makefile for generating `local.cfg`.

### `kamailio/tls.cfg`
TLS profile file for Kamailio.
Current settings:
- `method = TLSv1.2+`
- server cert/key from `/certs/fullchain.pem` and `/certs/privkey.pem`
- certificate verification disabled for both server/client profiles

---

## Reverse proxy/web frontend

### `nginx/phone.srve.cc.conf` (ACTIVE)
Nginx vhost used by WebRTC page.

Current behavior:
- HTTP 80 redirects to HTTPS
- HTTPS 443 serves static site from `/var/www/phone`
- `/ws` location proxies websocket to `http://38.242.157.239:8443`
- passes required websocket headers including `Sec-WebSocket-Protocol`
- long read/send timeout (`3600s`) for persistent WS

### `nginx/phone.srve.cc.conf.template`
Template variant for env-rendered deployment.

---

## TURN/STUN

### `coturn/turnserver.conf` (current file in repo)
Includes TURN settings such as:
- ports 3478/5349
- realm/server-name
- long-term credential auth
- external-ip mapping
- relay port range 49160-49200

### `coturn/turnserver.conf.template`
Template used by render scripts/Makefile to generate final coturn config.

Important runtime note:
- In current `docker-compose.yml`, Coturn is started with CLI arguments directly.
- That means compose command-line options are the effective runtime source of truth.

---

## RTP media anchor

### `rtpengine/rtpengine.conf`
Contains rtpengine settings.

### `rtpengine/rtpengine.conf.template`
Template used by render flow.

Important runtime note:
- In current `docker-compose.yml`, rtpengine also uses command-line arguments.
- Those compose args are the effective runtime source of truth.

---

## Web client

### `www/config.js`
Runtime web app config:
- `PBX_IP: "testfusn.srve.cc"`
- `WSS_HOST: "phone.srve.cc"`
- `TURN_HOST: "phone.srve.cc"`

### `www/app.js`
SIP.js client logic:
- registers over WSS
- uses TURN/STUN from config
- currently has:
  - `FORCE_RELAY = true`
  - `ICE_TRANSPORT_POLICY = relay` (because FORCE_RELAY true)
  - G711 codec filtering enabled

---

## Render and operations scripts

### `Makefile`
Operational entry points:
- `make check` validates env/certs/templates/ports
- `make render` renders templates to concrete conf files
- `make up/down/restart/logs/ps`

### `scripts/render-*.sh`
Template rendering helper scripts using `envsubst`:
- `render-coturn.sh`
- `render-rtpengine.sh`
- `render-kamailio.sh`
- `render-nginx.sh`

### `scripts/enforce-single-containers.sh`
Detects duplicate containers for declared `container_name` entries; optional `--fix` removes older duplicates.

---

## 3) What was broken and how it was fixed

### Symptom
- Browser showed transport Connected and REGISTER sent.
- SIP.js received `408 Request Timeout`.
- PBX side initially saw malformed/unsupported signaling or no usable response path.

### Root causes found
1. Header rewrite logic produced malformed Via in one iteration (`SIP/2.0/UDPSIP/2.0/UDP`) causing Kamailio parse errors.
2. Duplicate `set_contact_alias()` calls triggered nathelper warnings.
3. UDP-only PBX interoperability needed WS-specific header normalization for forwarded REGISTER.

### Fixes now in active config
- Safe single-pass Via normalization (`WS/WSS -> UDP`) for WS-originated traffic.
- Removed duplicate alias update path that caused contact update conflicts.
- On forwarded REGISTER from WebSocket clients, removed WS-specific Contact params:
  - `;transport=ws`
  - `;alias=...`

Result:
- Registration is now working.

---

## 4) Fast troubleshooting checklist (reuse this next time)

## Step A: Verify websocket ingress
- Check Nginx websocket upgrade entries:
  - expected: HTTP 101 for `GET /ws`

## Step B: Verify Kamailio receives REGISTER
- Look for logs like:
  - `WS SIP REGISTER ...`
  - `RELAY_TO_PBX via udp ... Method: REGISTER`

## Step C: Verify outbound SIP leaves SBC host
- Capture outbound UDP to PBX and inspect REGISTER/Via/Contact.

## Step D: Verify PBX replies
- Capture inbound UDP from PBX back to SBC host.
- If outbound exists but inbound is empty, issue is PBX ACL/firewall/routing or PBX listener.

## Step E: Validate runtime env and DNS inside Kamailio
- Confirm `PBX_IP`, `PBX_PORT`, `PBX_TRANSPORT`
- Confirm `getent hosts $PBX_IP`

---

## 5) Known-good expectations

When healthy:
- Browser transport: Connected
- Kamailio logs:
  - WS REGISTER received
  - RELAY_TO_PBX log appears
- PBX sees REGISTER from SBC public IP on UDP/5060
- PBX sends SIP response (401/407/200/etc.) back to SBC
- Browser receives SIP response over websocket (not local 408 timeout)

---

## 6) Change safety rules (important)

1. Do not remove Via headers entirely.
2. If rewriting Via transport, use one safe regex pass to avoid double substitution corruption.
3. Avoid calling `set_contact_alias()` multiple times in same request path.
4. Keep PBX relay transport explicitly UDP for this PBX.
5. After any Kamailio change:
   - syntax check
   - restart
   - verify one test REGISTER end-to-end (Nginx -> Kamailio -> PBX -> back)

---

## 7) Files to review first during future incidents

1. `docker-compose.yml`
2. `kamailio/kamailio.cfg`
3. `nginx/phone.srve.cc.conf`
4. `www/config.js`
5. `www/app.js`
6. `coturn/turnserver.conf` and template
7. `rtpengine/rtpengine.conf` and template

---

## 8) Optional hardening improvements (future)

- Add a dedicated debug route with Call-ID tagging for REGISTER traces.
- Keep one source of truth per component (either command args or conf file) to reduce confusion.
- Add a small health-check script that tests:
  - websocket upgrade
  - UDP reachability to PBX:5060
  - basic SIP OPTIONS or REGISTER probe

---

## 9) Quick commands (copy/paste)

Use these from SBC host unless marked PBX.

### A. Container health

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker logs kamailio --tail 120
docker logs phone-nginx --tail 120
```

### B. Verify WebSocket upgrade at Nginx

```bash
docker logs phone-nginx --since 10m | grep -E 'GET /ws| 101 '
```

Expected: `GET /ws ... 101`

### C. Verify Kamailio receives and relays REGISTER

```bash
docker logs kamailio --since 10m 2>&1 | \
grep -Ei 'WS SIP REGISTER|RELAY_TO_PBX|REGISTER|parse_via|bad via|408|timeout'
```

Expected:
- `WS SIP REGISTER ...`
- `RELAY_TO_PBX via udp ... Method: REGISTER`

### D. Confirm active PBX target inside Kamailio

```bash
docker exec kamailio sh -lc 'echo PBX_IP=$PBX_IP PBX_PORT=$PBX_PORT PBX_TRANSPORT=$PBX_TRANSPORT; getent hosts "$PBX_IP" || true'
```

Expected:
- `PBX_TRANSPORT=udp`
- PBX hostname resolves to correct IP

### E. Capture outbound REGISTER from SBC -> PBX

```bash
tcpdump -ni any -s0 -A 'udp and dst host 185.187.169.29 and dst port 5060' | \
egrep -i 'REGISTER|Via:|Contact:|To:|From:|CSeq:'
```

Expected:
- REGISTER packets visible
- Via shows `SIP/2.0/UDP`

### F. Capture inbound SIP response PBX -> SBC

```bash
tcpdump -ni any -s0 -A 'udp and src host 185.187.169.29 and src port 5060 and dst host 38.242.157.239' | \
egrep -i 'SIP/2.0|401|403|407|200|Via:|CSeq:|REGISTER'
```

If outbound exists but inbound is empty, problem is usually PBX ACL/firewall/routing.

### G. PBX-side capture (run on PBX)

```bash
tcpdump -ni any -s0 -A 'host 38.242.157.239 and udp port 5060' | egrep -i 'REGISTER|SIP/2.0|Via:|CSeq:'
```

Use this to confirm PBX receives REGISTER and sends replies back.

### H. Quick Kamailio syntax + restart

```bash
docker exec kamailio sh -lc 'kamailio -c -f /etc/kamailio/kamailio.cfg'
docker restart kamailio
docker logs kamailio --since 1m
```

### I. One-shot direct UDP probe to PBX (network isolation test)

```bash
python3 - << 'PY'
import socket,random
pbx=('185.187.169.29',5060)
local_ip='38.242.157.239'
branch=f'z9hG4bK{random.randint(100000,999999)}'
callid=f'test{random.randint(1000,9999)}@{local_ip}'
msg=(
f"REGISTER sip:testfusn.srve.cc SIP/2.0\r\n"
f"Via: SIP/2.0/UDP {local_ip}:5062;branch={branch};rport\r\n"
f"Max-Forwards: 70\r\n"
f"From: <sip:900900@testfusn.srve.cc>;tag=probe\r\n"
f"To: <sip:900900@testfusn.srve.cc>\r\n"
f"Call-ID: {callid}\r\n"
f"CSeq: 1 REGISTER\r\n"
f"Contact: <sip:900900@{local_ip}:5062>\r\n"
f"Expires: 60\r\n"
f"Content-Length: 0\r\n\r\n"
)
s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
s.bind(('0.0.0.0',5062))
s.sendto(msg.encode(),pbx)
s.settimeout(5)
print('sent to',pbx)
try:
  data,addr=s.recvfrom(65535)
  print('response from',addr)
  print(data.decode(errors='ignore').split('\r\n\r\n')[0])
except Exception as e:
  print('no response:',e)
PY
```

If this direct test gets no response, issue is outside WebRTC app/Kamailio (network or PBX policy).

