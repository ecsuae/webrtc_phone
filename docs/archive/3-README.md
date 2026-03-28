# Batch 3: One-Way Audio & Security - RESOLVED ✅

## Overview

**Goal:** Fix one-way audio issue where browser can hear remote party but remote party cannot hear browser.

**Status:** 
- ✅ Infrastructure issues resolved
- ✅ Port 5060 security implemented
- ✅ Audio issue fully resolved - bidirectional audio working!

---

## What We Fixed

### 1. Infrastructure: Host Network Mode (✅ CRITICAL FIX)

**Problem:** Services in Docker bridge mode prevented RTPengine connectivity.

**Solution:** Converted all services to host network mode.

**Changes:**
```yaml
# docker-compose.yml
services:
  kamailio:
    network_mode: host  # Was: bridge
  rtpengine:
    network_mode: host  # Was: bridge
  nginx:
    network_mode: host  # Was: bridge
  coturn:
    network_mode: host  # Already correct
```

```kamailio
# kamailio/kamailio.cfg - RTPengine socket
modparam("rtpengine", "rtpengine_sock", "udp:127.0.0.1:2223")
# Was: udp:rtpengine:2223 (DNS doesn't work in host mode)
```

**Impact:**
- RTPengine now reachable by Kamailio
- SDP offer/answer operations successful
- DTLS/SRTP negotiation working
- PBX → Browser audio flows correctly

### 2. Security: Port 5060 Attack Protection (✅ IMPLEMENTED)

**Problem:** Port 5060 exposed to internet, receiving constant scanning/hacking attempts forwarded to PBX.

**Solution:** IP whitelist in Kamailio request_route.

**Implementation:**
```kamailio
request_route {
    # Block unauthorized IPs on UDP/TCP 5060
    if ($proto != "ws" && $proto != "wss") {
        # Whitelist: PBX IP, localhost, and self
        if ($si != "185.187.169.29" && $si != "127.0.0.1" && $si != "38.242.157.239") {
            xlog("L_WARN", "BLOCKED unauthorized SIP: $rm from $si:$sp to $ru\n");
            sl_send_reply("403", "Forbidden");
            exit;
        }
    }
    # WebSocket connections unaffected
}
```

**Results:**
- ✅ Hackers/scanners blocked with 403 Forbidden
- ✅ PBX traffic (185.187.169.29) allowed
- ✅ WebSocket connections (browser via Nginx) unaffected
- ✅ Verified working: Already blocking attacks (e.g., 15.204.144.239)

**Monitoring:**
```bash
# View blocked attempts
docker compose logs kamailio | grep "BLOCKED"
```

### 3. RTPengine Configuration Optimization (⏳ IN PROGRESS)

**Current Best Configuration:**
```kamailio
route[MEDIA_OFFER] {
    # Minimal flags - best stability
    rtpengine_offer("replace-origin replace-session-connection");
}

route[MEDIA_ANSWER] {
    # Minimal flags - best stability
    rtpengine_answer("replace-origin replace-session-connection");
}
```

**What We Learned:**
- Both browser and PBX support `UDP/TLS/RTP/SAVPF` (DTLS/SRTP)
- Symmetric DTLS bridging required (not asymmetric conversion)
- Most aggressive flags break calls or don't help
- Minimal flags provide best stability

---

## Current State

### ✅ All Components Working

1. **Registration:** Browser registers to PBX successfully
2. **Call signaling:** INVITE, 200 OK, ACK all working
3. **DTLS handshake:** Completes between PBX and browser
4. **PBX → Browser audio:** Remote party audio reaches browser perfectly ✅
5. **Browser → PBX audio:** Browser audio reaches remote party perfectly ✅
6. **Security:** Port 5060 protected from unauthorized access
7. **Infrastructure:** All services in correct network mode
8. **Call stability:** Calls stay connected without drops

### 🎉 Audio Issue Resolved!

**What was the problem:**
- Browser audio wasn't reaching PBX (one-way audio)

**How it was fixed:**
1. **Host network mode** - Critical infrastructure change
2. **Minimal RTPengine flags** - `replace-origin replace-session-connection`
3. **Proper IP advertising** - Public IP in SDP
4. **RTPengine configuration** - Correct socket and interface binding

**Result:**
- ✅ Browser can hear remote party
- ✅ Remote party can hear browser
- ✅ DTLS/SRTP negotiation successful
- ✅ Calls stable and don't disconnect

---

## How to Test

### 1. Make a Call (Bidirectional Audio Test)
```
1. Open browser to https://phone.srve.cc
2. Register with extension (e.g., 900900)
3. Dial a number (e.g., 045945060)
4. Call connects successfully
5. You hear remote party? YES ✅
6. Remote party hears you? YES ✅
7. Call stays connected? YES ✅
```

### 2. Check Security
```bash
# View blocked attack attempts
docker compose logs kamailio | grep "BLOCKED"

# Should see entries like:
# WARNING: BLOCKED unauthorized SIP: REGISTER from <attacker-ip>
```

### 3. Check RTPengine Stats (Bidirectional Packets)
```bash
# View packet statistics after call
docker compose logs rtpengine 2>&1 | grep -E '"stats".*packets' | tail -5

# Both directions should show packets > 0 ✅
```

---

## Troubleshooting Commands

```bash
# Check all containers running
docker ps --format "{{.Names}}: {{.Status}}"

# Check RTPengine connectivity
docker compose logs kamailio | grep "rtpengine_offer\|rtpengine_answer"

# Monitor calls in real-time
docker compose logs kamailio -f | grep -E "INVITE|MEDIA_OFFER|MEDIA_ANSWER"

# View security blocks
docker compose logs kamailio -f | grep "BLOCKED"

# Check Coturn status
docker compose logs coturn --tail 50

# Restart services if needed
docker restart kamailio rtpengine
```

---

## Files Modified in Batch 3

### docker-compose.yml
```yaml
# All services changed to host network mode
services:
  kamailio:
    network_mode: host
  rtpengine:
    network_mode: host
  nginx:
    network_mode: host
```

### kamailio/kamailio.cfg

**Changes:**
1. RTPengine socket: `udp:127.0.0.1:2223`
2. Listen advertise IPs: `38.242.157.239`
3. **NEW:** IP whitelist security in request_route
4. MEDIA_OFFER/MEDIA_ANSWER: Minimal flags

**Key Sections:**
```kamailio
# Security filter
request_route {
    if ($proto != "ws" && $proto != "wss") {
        if ($si != "185.187.169.29" && $si != "127.0.0.1" && $si != "38.242.157.239") {
            xlog("L_WARN", "BLOCKED unauthorized SIP: $rm from $si:$sp to $ru\n");
            sl_send_reply("403", "Forbidden");
            exit;
        }
    }
}

# Media routing
route[MEDIA_OFFER] {
    rtpengine_offer("replace-origin replace-session-connection");
}

route[MEDIA_ANSWER] {
    rtpengine_answer("replace-origin replace-session-connection");
}
```

---

## Additional Security Recommendations

### 1. OS-Level Firewall
```bash
# Block all except PBX IP
iptables -A INPUT -p udp --dport 5060 -s 185.187.169.29 -j ACCEPT
iptables -A INPUT -p tcp --dport 5060 -s 185.187.169.29 -j ACCEPT
iptables -A INPUT -p udp --dport 5060 -j DROP
iptables -A INPUT -p tcp --dport 5060 -j DROP
```

### 2. Move to Non-Standard Port
```kamailio
# Change 5060 to 15060 or other non-standard port
listen=udp:0.0.0.0:15060 advertise 38.242.157.239:15060
```
Update PBX to send to new port.

### 3. fail2ban
Configure automatic banning of repeated attempts:
```ini
[kamailio]
enabled = true
filter = kamailio
logpath = /var/log/kamailio.log
maxretry = 3
bantime = 86400
```

---

## Next Steps

### For Continued Security:
1. **OS-level firewall** - Implement iptables rules for defense in depth
2. **Move port 5060** to non-standard port (optional but recommended)
3. **Set up fail2ban** for automatic banning of repeated attempts
4. **Monitor logs regularly** for security threats

### For Production Deployment:
1. ✅ All core functionality working
2. ✅ Security hardening in place
3. ✅ Stable bidirectional audio
4. Consider additional monitoring/alerting
5. Document firewall rules and backup configurations

---

## Related Documentation

- **1-REGISTRATION.md** - Browser registration fixes (Batch 1)
- **2-INCOMING_CALL.md** - Duplicate calls and BYE handling (Batch 2)
- **3-ONESIDED_VOICE.md** - Detailed audio troubleshooting guide (this batch)

---

## Summary

**Batch 3 Achievements:**
- ✅ Fixed infrastructure (host network mode)
- ✅ Secured port 5060 from attacks
- ✅ Optimized RTPengine configuration
- ✅ PBX → Browser audio working
- ✅ Browser → PBX audio working
- ✅ Bidirectional audio fully functional
- ✅ Stable calls without disconnects

**Impact:**
- Calls connect and stay connected reliably
- Security significantly improved
- Attack attempts blocked automatically
- Full bidirectional audio working perfectly
- WebRTC SBC fully operational

**Final Status:**
🎉 **All issues resolved - System production ready!**
