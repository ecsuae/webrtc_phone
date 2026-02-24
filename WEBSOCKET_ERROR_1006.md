# WebSocket Connection Error 1006 - Troubleshooting

## Error Details

**Error:** `WebSocket closed wss://phone.srve.cc/ws (code: 1006)`

**Meaning:** Code 1006 = Abnormal Closure (connection closed without proper WebSocket close frame)

---

## Common Causes

1. **Kamailio container not running**
2. **Kamailio not listening on port 8443** 
3. **Nginx can't reach Kamailio** (network issue)
4. **Kamailio crashed/restarting**

---

## How to Fix

### Step 1: Restart Everything

```bash
cd /opt/webrtc-sbc
docker compose down --remove-orphans
docker compose up -d
sleep 10
```

### Step 2: Check Container Status

```bash
docker compose ps
```

**Expected:** All 3 containers showing "Up"
- coturn
- kamailio
- phone-nginx

### Step 3: Verify Kamailio is Listening

```bash
docker exec kamailio netstat -tln | grep 8443
```

**Expected:** Should show `0.0.0.0:8443` or `:::8443`

### Step 4: Check Kamailio Logs

```bash
docker logs kamailio 2>&1 | tail -30
```

**Look for:**
- ✅ "listening on tcp:0.0.0.0:8443"
- ❌ Any ERROR or CRITICAL messages

### Step 5: Check Nginx Can Reach Kamailio

```bash
docker exec phone-nginx wget -O- http://kamailio:8443 2>&1
```

**Expected:** Should connect (even if returns error page)

### Step 6: Test WebSocket from Outside

```bash
curl -skI https://phone.srve.cc/ws
```

**Expected:** Should return HTTP response (426 Upgrade Required or similar)

---

## Quick Commands to Run

```bash
# 1. Restart system
cd /opt/webrtc-sbc && docker compose restart

# 2. Check all containers running
docker compose ps

# 3. Follow Kamailio logs
docker logs kamailio -f

# 4. Follow Nginx logs  
docker logs phone-nginx -f
```

---

## If Kamailio Won't Start

Check the logs:
```bash
docker logs kamailio 2>&1
```

Common issues:
- Port 8443 already in use
- Configuration syntax error
- Missing module
- Memory limit

---

## If Nginx Can't Connect

Check network:
```bash
docker network inspect webrtc-sbc_webrtc
```

All containers should be on same network.

---

## Current Configuration

From your .env:
- DOMAIN=phone.srve.cc ✅
- PUBLIC_IP=38.242.157.239 ✅
- PBX_IP=testfusn.srve.cc ✅ (correct - needs domain for multi-tenant)
- PBX_PORT=5060 ✅

Nginx config:
- Listens on 443 (HTTPS/WSS)
- Proxies /ws → kamailio:8443

Kamailio config:
- Listens on tcp:0.0.0.0:8443 (WebSocket)
- Has event_route[xhttp:request] for WebSocket handshake

---

## Manual Testing Steps

### 1. Start System
```bash
cd /opt/webrtc-sbc
docker compose up -d
```

### 2. Wait 15 seconds
```bash
sleep 15
```

### 3. Check Status
```bash
docker compose ps
docker logs kamailio | grep -i "listening\|error"
docker logs phone-nginx | grep -i error
```

### 4. Test Registration
- Open https://phone.srve.cc/
- Enter:
  - Extension: 900900
  - Domain: testfusn.srve.cc
  - Password: your_password
- Click "Start and Register"

### 5. Watch Logs During Registration
```bash
# Terminal 1
docker logs kamailio -f

# Terminal 2  
docker logs phone-nginx -f
```

---

## What to Look For in Logs

### Kamailio (when registration attempted):

**Good:**
```
HTTP request GET from x.x.x.x
ws_handle_handshake()
REGISTER from 900900@testfusn.srve.cc
```

**Bad:**
```
ERROR: ...
CRITICAL: ...
Connection refused
```

### Nginx:

**Good:**
```
Upgraded connection to WebSocket
```

**Bad:**
```
connect() failed
upstream timed out
502 Bad Gateway
```

---

## Next Steps

1. **Run restart.sh**: `bash /opt/webrtc-sbc/restart.sh`
2. **Check containers are running**: `docker compose ps`
3. **Try registration again**
4. **If fails, check logs**: `docker logs kamailio -f`

The WebSocket error 1006 will be fixed once Kamailio is properly running and listening on port 8443.

