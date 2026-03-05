# WebRTC SBC - INSTANT RESTORATION GUIDE

**Last Updated:** 2026-02-28  
**Purpose:** Restore WebRTC registration to working state in under 5 minutes

---

## 🚨 INSTANT RECOVERY (Copy-Paste These Commands)

If registration is broken, run these commands to restore to last known working state:

```bash
cd /opt/webrtc-sbc

# 1. Restore Nginx WebSocket proxy configuration
cat > nginx/phone.srve.cc.conf << 'EOF'
server {
  listen 80;
  server_name phone.srve.cc;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name phone.srve.cc;

  ssl_certificate /certs/fullchain.pem;
  ssl_certificate_key /certs/privkey.pem;

  root /var/www/phone;
  index index.html;

  location = /ws {
    # Kamailio is in host network mode, reach via Docker gateway IP
    proxy_pass http://172.18.0.1:8443;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # IMPORTANT for Kamailio SIP-over-WS
    proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;

    proxy_buffering off;
    proxy_request_buffering off;

    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 5s;
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
EOF

# 2. Verify docker-compose.yml has correct network mode for kamailio
# Kamailio MUST be in host mode, nginx in bridge mode

# 3. Restart containers
docker restart phone-nginx kamailio

# 4. Wait and verify
sleep 5
docker ps --filter name="kamailio|nginx" --format "table {{.Names}}\t{{.Status}}"

# 5. Check logs for errors
docker logs kamailio --tail 20 | grep -i error
docker logs phone-nginx --tail 20 | grep -i error

# 6. Test WebSocket connection (should see 101 Switching Protocols)
timeout 30 docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "HTTP request" | head -3
```

**Now test registration from browser at https://phone.srve.cc**

---

## ⚙️ CRITICAL CONFIGURATION VALUES

### Network Architecture (DO NOT CHANGE)

| Component | Network Mode | Why |
|-----------|-------------|-----|
| **kamailio** | `host` | Needs direct access to host network for SIP/RTP |
| **nginx** | `bridge` (webrtc network) | Standard web proxy |
| **rtpengine** | `bridge` (webrtc network) | Controlled port exposure |
| **coturn** | `host` | TURN/STUN requires direct network access |

### Nginx Proxy Configuration (CRITICAL)

**File:** `nginx/phone.srve.cc.conf`

**CRITICAL VALUE:**
```nginx
proxy_pass http://172.18.0.1:8443;
```

**Why this IP?**
- Kamailio runs in **host network mode** (not on Docker bridge)
- Nginx runs in **bridge mode** on the `webrtc` Docker network
- `172.18.0.1` is the Docker bridge gateway IP that routes to host
- Nginx uses this to reach Kamailio's port 8443 on the host

**WRONG VALUES (will break):**
- ❌ `proxy_pass http://kamailio:8443;` (DNS resolution fails, kamailio not on bridge)
- ❌ `proxy_pass http://127.0.0.1:8443;` (nginx container's localhost, not host's)
- ❌ `proxy_pass http://38.242.157.239:8443;` (external IP, routing issues)

**How to find the correct gateway IP if it changes:**
```bash
docker exec phone-nginx ip route | grep default | awk '{print $3}'
```

---

## 📋 COMPLETE WORKING CONFIGURATIONS

### 1. Kamailio Configuration (`kamailio/kamailio.cfg`)

**CRITICAL SECTION:** Route[RELAY_TO_PBX] - Lines 299-346

This section does the magic that makes WebRTC work with UDP-only PBX:

```kamailio
route[RELAY_TO_PBX] {
    # PBX host must come from env PBX_IP (or fail loudly)
    $var(pbx_host) = $env(PBX_IP);
    if ($var(pbx_host) == $null || $var(pbx_host) == "") {
        xlog("L_ERR", "RELAY_TO_PBX: PBX_IP not set in environment; cannot relay\n");
        sl_send_reply("503", "Server Error");
        exit;
    }

    # PBX port: default 5060 when not provided
    $var(pbx_port) = $env(PBX_PORT);
    if ($var(pbx_port) == $null || $var(pbx_port) == "") {
        $var(pbx_port) = "5060";
    }

    # Transport: default udp
    $var(pbx_transport) = $env(PBX_TRANSPORT);
    if ($var(pbx_transport) == $null || $var(pbx_transport) == "") {
        $var(pbx_transport) = "udp";
    }

    xlog("L_INFO", "RELAY_TO_PBX via $var(pbx_transport) to $var(pbx_host):$var(pbx_port) from $si:$sp | Method: $rm, Request-URI: $ru, From: $fu, To: $tu\n");

    # ⚠️ CRITICAL: PBX only understands standard UDP SIP transport
    # Normalize Via transport token WS/WSS -> UDP (single regex avoids double replacement)
    if ($proto == "ws" || $proto == "wss") {
        subst_hf("Via", "/SIP\/2.0\/(WSS|WS)/SIP\/2.0\/UDP/ig", "a");

        # ⚠️ CRITICAL: UDP-only PBX compatibility for WebRTC REGISTER
        if (is_method("REGISTER")) {
            subst_hf("Contact", "/;transport=ws//ig", "a");
            subst_hf("Contact", "/;alias=[^;>]*//ig", "a");
        }

        msg_apply_changes();
    }

    # Send everything to FusionPBX (registrations and calls)
    $du = "sip:" + $var(pbx_host) + ":" + $var(pbx_port) + ";transport=" + $var(pbx_transport);

    # Let us touch replies (useful for SDP answer)
    t_on_reply("MANAGE_REPLY");

    route(RELAY);
    exit;
}
```

**What this does:**
1. Reads PBX destination from environment variables
2. **Rewrites Via headers:** `SIP/2.0/WSS` → `SIP/2.0/UDP`
3. **Strips WebSocket Contact params:** removes `;transport=ws` and `;alias=...`
4. Forwards to PBX as clean UDP SIP

**Why it's critical:**
- Without Via normalization: PBX sees "SIP/2.0/WSS" and rejects as unknown transport
- Without Contact cleanup: PBX tries to reply with WebSocket params causing errors

---

### 2. Docker Compose Configuration (`docker-compose.yml`)

**CRITICAL SECTIONS:**

```yaml
  kamailio:
    image: ghcr.io/kamailio/kamailio:5.8.2-jammy
    container_name: kamailio
    restart: unless-stopped
    env_file: .env
    environment:
      - PBX_IP=${PBX_IP}              # ⚠️ MUST be set in .env
      - PBX_PORT=${PBX_PORT}          # ⚠️ MUST be set in .env
      - PBX_TRANSPORT=udp             # ⚠️ MUST be udp
      - KAM_PUBLIC_IP=${PUBLIC_IP}
    depends_on:
      - rtpengine
    ports:
      - "8443:8443/tcp"               # ⚠️ CRITICAL: Published for host mode
    volumes:
      - ./kamailio/kamailio.cfg:/etc/kamailio/kamailio.cfg:ro
      - ./kamailio/local.cfg:/etc/kamailio/local.cfg:ro
      - ./kamailio/tls.cfg:/etc/kamailio/tls.cfg:ro
      - ./certs:/certs:ro
    networks:
      - webrtc

  nginx:
    image: nginx:alpine
    container_name: phone-nginx
    restart: unless-stopped
    depends_on:
      - kamailio
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/phone.srve.cc.conf:/etc/nginx/conf.d/default.conf:ro
      - ./www:/var/www/phone:ro
      - ./certs:/certs:ro
    networks:
      - webrtc                        # ⚠️ MUST be on same network as rtpengine
```

**Environment Variables Required (`.env` file):**
```bash
PBX_IP=testfusn.srve.cc
PBX_PORT=5060
PUBLIC_IP=38.242.157.239
```

---

## 🔍 VERIFICATION CHECKLIST

Run these commands to verify working state:

### 1. Container Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "kamailio|nginx|rtpengine|coturn"
```
**Expected:** All containers "Up" status

### 2. Kamailio Listening Ports
```bash
netstat -tuln | grep -E ":5060|:8443"
```
**Expected:**
```
tcp    0.0.0.0:8443   LISTEN
tcp    0.0.0.0:5060   LISTEN
udp    0.0.0.0:5060
```

### 3. Nginx Can Reach Kamailio
```bash
docker exec phone-nginx wget -O- --timeout=2 http://172.18.0.1:8443 2>&1 | head -5
```
**Expected:** Should connect (may get 404, but connection succeeds)

### 4. Test Registration (Live Monitor)
```bash
# Terminal 1: Start monitoring
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "HTTP request|WS SIP|RELAY_TO_PBX"

# Terminal 2: Attempt registration from browser at https://phone.srve.cc
# Extension: 900900 (or your test ext)
# Domain: testfusn.srve.cc
# Password: [your password]
```

**Expected logs:**
```
INFO: HTTP request GET from 172.18.0.3:XXXXX to /ws (port=8443)
INFO: WS SIP REGISTER from 172.18.0.3:XXXXX
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 from 172.18.0.3:XXXXX | Method: REGISTER
```

### 5. Verify PBX Receives REGISTER
```bash
tcpdump -i any -n -A 'udp and dst host testfusn.srve.cc and dst port 5060' | grep -A 5 REGISTER
```
**Expected:** See REGISTER packets with `Via: SIP/2.0/UDP` (not WSS/WS)

---

## 🐛 COMMON ISSUES & INSTANT FIXES

### Issue 1: "502 Bad Gateway" when connecting to `/ws`

**Symptom:**
```bash
docker logs phone-nginx | grep "/ws"
# Shows: upstream: "http://172.18.0.1:8443/ws" failed
```

**Diagnosis:**
```bash
# Check if Kamailio is actually listening
netstat -tuln | grep 8443

# Check if gateway IP is correct
docker exec phone-nginx ip route | grep default
```

**Fix:**
```bash
# If gateway IP changed, update nginx config
GATEWAY=$(docker exec phone-nginx ip route | grep default | awk '{print $3}')
sed -i "s|proxy_pass http://.*:8443;|proxy_pass http://$GATEWAY:8443;|" nginx/phone.srve.cc.conf
docker restart phone-nginx
```

---

### Issue 2: Registration gets "408 Request Timeout"

**Symptom:** Browser shows registration timeout, no PBX response

**Diagnosis:**
```bash
# Check if REGISTER reaches Kamailio
docker logs kamailio --since 1m | grep "WS SIP REGISTER"

# Check if forwarded to PBX
docker logs kamailio --since 1m | grep "RELAY_TO_PBX.*REGISTER"

# Check if packets leave to PBX
tcpdump -i any -c 5 -n 'udp and dst port 5060' | grep REGISTER
```

**Fix Options:**

**Option A: Via/Contact normalization missing**
```bash
# Verify kamailio.cfg has the critical normalization code
grep -A 5 "subst_hf.*Via.*WSS" kamailio/kamailio.cfg
grep -A 2 "subst_hf.*Contact.*transport=ws" kamailio/kamailio.cfg

# If missing, restore from this runbook (see section above)
# Then:
docker restart kamailio
```

**Option B: PBX environment variables not set**
```bash
docker exec kamailio env | grep -E "PBX_IP|PBX_PORT"
# If empty, check .env file:
cat .env | grep PBX_

# Fix:
echo "PBX_IP=testfusn.srve.cc" >> .env
echo "PBX_PORT=5060" >> .env
docker restart kamailio
```

---

### Issue 3: WebSocket connection immediately closes

**Symptom:** Browser shows "Disconnected" immediately after connecting

**Diagnosis:**
```bash
# Check nginx WebSocket upgrade
docker logs phone-nginx --since 1m | grep -E "GET /ws|101"

# Check Kamailio xhttp event
docker logs kamailio --since 1m | grep "HTTP request"
```

**Fix:**
```bash
# Verify Sec-WebSocket-Protocol header is passed
grep "Sec-WebSocket-Protocol" nginx/phone.srve.cc.conf

# If missing, add to location = /ws block:
#   proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;

docker restart phone-nginx
```

---

### Issue 4: Kamailio container won't start

**Symptom:**
```bash
docker ps -a | grep kamailio
# Shows "Exited" status
```

**Diagnosis:**
```bash
docker logs kamailio
```

**Common Errors & Fixes:**

**"parameter <db_mode> not found in module <sanity>"**
```bash
# Remove this line from kamailio.cfg:
sed -i '/modparam("sanity", "db_mode"/d' kamailio/kamailio.cfg
docker restart kamailio
```

**"parse error in config file"**
```bash
# Syntax check:
docker run --rm -v $PWD/kamailio/kamailio.cfg:/tmp/test.cfg \
  ghcr.io/kamailio/kamailio:5.8.2-jammy kamailio -c -f /tmp/test.cfg
# Fix syntax errors shown, then restart
```

---

## 📊 ARCHITECTURE DIAGRAM

```
Browser (SIP.js)
    |
    | WSS (TLS WebSocket)
    | wss://phone.srve.cc/ws
    ↓
[Nginx Container]
- Port 443 (HTTPS/WSS)
- Bridge network: 172.18.0.x
    |
    | HTTP (plain WebSocket after TLS termination)
    | http://172.18.0.1:8443  ← Docker gateway IP
    ↓
[Host Network: 38.242.157.239]
    ↓
[Kamailio Container]
- Port 8443 (WS)
- Port 5060 (SIP UDP/TCP)
- Host network mode
- Normalizes: WSS→UDP headers
    |
    | SIP UDP
    | Via: SIP/2.0/UDP (normalized from WSS)
    ↓
[PBX: testfusn.srve.cc:5060]
- FusionPBX
- UDP-only SIP
```

**Key Points:**
1. TLS termination happens at Nginx
2. Kamailio sees plain WebSocket (not WSS)
3. Kamailio in host mode can directly bind to host ports
4. Nginx reaches Kamailio via Docker bridge gateway (172.18.0.1)

---

## 🔧 TROUBLESHOOTING TOOLS

### Quick Status Check
```bash
#!/bin/bash
echo "=== Container Status ==="
docker ps --filter name="kamailio|nginx|rtpengine|coturn" --format "table {{.Names}}\t{{.Status}}"

echo -e "\n=== Network Ports ==="
netstat -tuln | grep -E ":5060|:8443|:3478|:2223|:443"

echo -e "\n=== PBX Environment ==="
docker exec kamailio env | grep PBX_

echo -e "\n=== Recent Errors ==="
docker logs kamailio --tail 50 | grep -i error | tail -5
docker logs phone-nginx --tail 50 | grep -i error | tail -5

echo -e "\n=== Last REGISTER attempt ==="
docker logs kamailio --tail 100 | grep -E "WS SIP REGISTER|RELAY_TO_PBX" | tail -3
```

### Live Traffic Monitor
```bash
# Watch all SIP REGISTER activity in real-time
docker logs kamailio -f 2>&1 | grep --line-buffered -E "REGISTER|401|407|200 OK"
```

### WebSocket Connection Test
```bash
# Test WebSocket handshake from command line
docker run --rm -it --network webrtc alpine/curl:latest \
  curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://172.18.0.1:8443/ws
# Expected: "HTTP/1.1 101" response
```

---

## 📝 MAINTENANCE CHECKLIST

### Before Any Configuration Change
1. Backup current configs:
   ```bash
   cp kamailio/kamailio.cfg kamailio/kamailio.cfg.backup.$(date +%Y%m%d_%H%M%S)
   cp nginx/phone.srve.cc.conf nginx/phone.srve.cc.conf.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. Test registration is working:
   ```bash
   timeout 30 docker logs kamailio -f --tail 0 2>&1 | grep "WS SIP REGISTER" | head -1
   ```
   (Attempt registration from browser during this 30sec window)

3. Document what you're changing and why

### After Any Configuration Change
1. Restart affected containers:
   ```bash
   docker restart kamailio nginx
   ```

2. Check for startup errors:
   ```bash
   sleep 3
   docker logs kamailio --tail 20 | grep -i error
   docker logs phone-nginx --tail 20 | grep -i error
   ```

3. Verify registration still works (run test above)

4. If broken, restore from backup:
   ```bash
   cp kamailio/kamailio.cfg.backup.YYYYMMDD_HHMMSS kamailio/kamailio.cfg
   docker restart kamailio
   ```

---

## 🎯 QUICK REFERENCE: CRITICAL VALUES

| Setting | File | Value | Why |
|---------|------|-------|-----|
| Nginx proxy_pass | `nginx/phone.srve.cc.conf` | `http://172.18.0.1:8443` | Docker gateway to reach host-mode Kamailio |
| Kamailio network_mode | `docker-compose.yml` | `host` | Direct host network access for SIP |
| Via normalization | `kamailio/kamailio.cfg` | `subst_hf("Via", "/SIP\/2.0\/(WSS\|WS)/SIP\/2.0\/UDP/ig", "a")` | PBX needs UDP transport |
| Contact cleanup (REGISTER) | `kamailio/kamailio.cfg` | Remove `;transport=ws` and `;alias=...` | PBX can't handle WebSocket params |
| PBX_IP | `.env` | `testfusn.srve.cc` | Target PBX hostname |
| PBX_PORT | `.env` | `5060` | Target PBX port |
| PBX_TRANSPORT | `docker-compose.yml` | `udp` | PBX only supports UDP |

---

## 🆘 EMERGENCY RESTORE

If everything is completely broken, run this complete restoration:

```bash
cd /opt/webrtc-sbc

# Stop all
docker stop kamailio phone-nginx rtpengine coturn

# Restore critical configs from this runbook
# (Copy nginx config from "INSTANT RECOVERY" section above)

# Verify .env has PBX settings
cat > .env << 'EOF'
PBX_IP=testfusn.srve.cc
PBX_PORT=5060
PUBLIC_IP=38.242.157.239
EOF

# Start in order
docker start rtpengine
sleep 2
docker start coturn
sleep 2
docker start kamailio
sleep 2
docker start phone-nginx

# Wait for startup
sleep 5

# Check status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test
echo "Now test registration at https://phone.srve.cc"
timeout 60 docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "WS SIP REGISTER" | head -3
```

---

**END OF RUNBOOK**

*Keep this document updated whenever configuration changes are made that affect registration.*
