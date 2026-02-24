# Outgoing Call Troubleshooting Guide

## Current Status
- **Registration**: ✅ Working
- **Outgoing Calls**: ❌ Not Working
- **Configuration**: Simple/Stable (no direction flags)

---

## Quick Diagnostic Steps

### 1. Check All Containers Are Running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Expected Output:**
```
NAMES         STATUS
phone-nginx   Up X minutes
kamailio      Up X minutes
rtpengine     Up X minutes
coturn        Up X minutes
```

**If any container is missing or restarting:**
```bash
cd /opt/webrtc-sbc
docker compose up -d
```

---

### 2. Check Kamailio Can Reach RTPEngine

```bash
docker logs kamailio 2>&1 | grep -i "rtpengine.*found"
```

**Expected:**
```
INFO: rtpengine [rtpengine.c:3428]: rtpp_test(): rtpengine instance <udp:rtpengine:22222> found, support for it enabled
```

**If NOT found:**
```bash
docker restart rtpengine
sleep 5
docker restart kamailio
```

---

### 3. Check for RTPEngine Errors

```bash
docker logs kamailio 2>&1 | grep -i "rtpengine.*error" | tail -10
```

**Common Errors:**

**A. "can't send command 'ping' to RTPEngine"**
```bash
# RTPEngine is down or unreachable
docker restart rtpengine kamailio
```

**B. "no available proxies"**
```bash
# RTPEngine not responding
docker logs rtpengine 2>&1 | tail -20
# Look for crash or errors
```

---

### 4. Watch Live Call Attempt

**Terminal 1 - Kamailio logs:**
```bash
docker logs -f kamailio 2>&1 | grep -i "INVITE\|MEDIA_OFFER\|error"
```

**Terminal 2 - Make a call from browser**

**What to look for:**
- ✅ `WS SIP INVITE from 172.18.0.X` - WebSocket received INVITE
- ✅ `MEDIA_OFFER rtpengine_manage()` - Processing media
- ❌ `ERROR: rtpengine` - RTPEngine problem
- ❌ `ERROR: tm` - Transaction issue

---

### 5. Common Issues & Fixes

#### Issue: RTPEngine Not Responding

**Symptoms:**
```
ERROR: rtpengine [rtpengine.c:3568]: send_rtpp_command(): can't send command "ping"
ERROR: rtpengine [rtpengine.c:3418]: rtpp_test(): proxy did not respond to ping
```

**Fix:**
```bash
# Check RTPEngine logs
docker logs rtpengine 2>&1 | tail -30

# If empty or crashing, restart
docker restart rtpengine
sleep 5
docker restart kamailio
sleep 5

# Verify
docker logs kamailio 2>&1 | grep "rtpengine.*found"
```

---

#### Issue: SIP INVITE Not Reaching FusionPBX

**Check Kamailio routing:**
```bash
docker logs kamailio 2>&1 | grep -i "relay\|route\|fusn04"
```

**Verify FusionPBX is reachable:**
```bash
docker exec kamailio ping -c 2 fusn04.srve.cc
```

---

#### Issue: Media Negotiation Failed

**Check SDP handling:**
```bash
docker logs kamailio 2>&1 | grep -i "MEDIA_OFFER\|MEDIA_ANSWER"
```

**Should see:**
```
INFO: <script>: MEDIA_OFFER rtpengine_manage() from 172.18.0.X proto=ws
INFO: <script>: MEDIA_ANSWER rtpengine_manage() from X.X.X.X proto=udp
```

---

### 6. Full Service Restart

**If nothing else works:**

```bash
cd /opt/webrtc-sbc

# Stop everything
docker compose down

# Wait
sleep 3

# Start everything
docker compose up -d

# Wait for services to initialize
sleep 15

# Check status
docker compose ps

# Check Kamailio connected to RTPEngine
docker logs kamailio 2>&1 | grep "rtpengine.*found"
```

---

### 7. Verify Configuration Files

**Check RTPEngine config is simple:**
```bash
cat /opt/webrtc-sbc/rtpengine/rtpengine.conf
```

**Should NOT have:**
- ❌ `interface = external/eth0!...;internal/eth0` (direction labels)
- ❌ `recording-dir` or `recording-method` (causes crashes)

**Should have:**
- ✅ `interface = eth0!38.242.157.239` (simple single interface)
- ✅ `listen-ng = 0.0.0.0:22222`

---

**Check Kamailio media routes:**
```bash
grep -A 5 "route\[MEDIA_OFFER\]" /opt/webrtc-sbc/kamailio/kamailio.cfg
```

**Should NOT have:**
- ❌ `direction=internal:external` or `direction=external:internal`

**Should have:**
- ✅ `ICE=remove DTLS=off RTP/AVP` (for WebRTC→PBX)
- ✅ `ICE=force DTLS=passive RTP/SAVPF` (for PBX→WebRTC)

---

### 8. Test Sequence

1. **Register** at https://phone.srve.cc ✅
2. **Open browser console** (F12 → Console tab)
3. **Make outgoing call** to any number
4. **Check browser console** for SIP INVITE message
5. **Check Kamailio logs**:
   ```bash
   docker logs kamailio 2>&1 | tail -50
   ```
6. **Look for**:
   - `WS SIP INVITE` - Call initiated
   - `MEDIA_OFFER` - Media processing
   - `rtpengine_manage()` - RTPEngine called
   - Any `ERROR` messages

---

### 9. Emergency Reset

**If system is completely broken:**

```bash
cd /opt/webrtc-sbc

# Nuclear option - remove everything
docker compose down --volumes --remove-orphans

# Clean Docker
docker system prune -f

# Restart Docker daemon
systemctl restart docker

# Wait
sleep 10

# Start fresh
docker compose up -d

# Monitor startup
docker compose logs -f
```

---

## Expected Successful Call Flow

```
1. Browser → WSS → Nginx → Kamailio
   [WebSocket INVITE received]

2. Kamailio → RTPEngine
   [Request media transcoding: WebRTC → RTP]

3. Kamailio → FusionPBX
   [Forward SIP INVITE to PBX]

4. FusionPBX → Kamailio
   [SIP 200 OK with SDP]

5. Kamailio → RTPEngine
   [Process SDP answer: RTP → WebRTC]

6. Kamailio → Browser
   [Return 200 OK with WebRTC SDP]

7. RTPEngine
   [Media flows: SRTP/DTLS ↔ RTP]
```

---

## Contact Information

**Logs Location:**
- Kamailio: `docker logs kamailio`
- RTPEngine: `docker logs rtpengine`
- Nginx: `docker logs phone-nginx`
- Coturn: `docker logs coturn`

**Configuration Files:**
- `/opt/webrtc-sbc/kamailio/kamailio.cfg`
- `/opt/webrtc-sbc/rtpengine/rtpengine.conf`
- `/opt/webrtc-sbc/nginx/phone.srve.cc.conf`
- `/opt/webrtc-sbc/docker-compose.yml`

**Documentation:**
- `/opt/webrtc-sbc/FIXES_APPLIED.md` - All applied fixes
- `/opt/webrtc-sbc/troubleshoot-calls.sh` - This guide

---

*Last Updated: February 12, 2026*

