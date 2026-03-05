# WebRTC SBC Registration Fix - Quick Reference

**Last Updated:** 2026-02-28  
**Problem:** WebRTC registration broken (WSS transport causes PBX compatibility issues)  
**Status:** ✅ Fixed

---

## 🚨 QUICK TEST: Is Registration Working?

```bash
# Test while attempting registration from browser
timeout 30 docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "WS SIP REGISTER" | head -3
```

- **See "WS SIP REGISTER"?** ✅ WebSocket working, check [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md) for PBX troubleshooting
- **See nothing?** ❌ Read full guide: [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)

---

## 📖 Full Documentation

**All fixes, configs, and troubleshooting:** [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)

This file contains:
- ⚡ Instant recovery commands (copy-paste restore)
- 🔧 Complete working configurations (nginx, kamailio, docker-compose)
- 🐛 Troubleshooting guide for common issues
- ✅ Verification checklist
- 📊 Log analysis examples

---

## 🎯 Common Problems → Solutions

| Problem | Quick Fix |
|---------|-----------|
| "502 Bad Gateway" at `/ws` | Check nginx `proxy_pass http://172.18.0.1:8443` |
| "408 Request Timeout" | Check Kamailio Via header normalization (WSS→UDP) |
| WebSocket connects then dies | Check nginx `Sec-WebSocket-Protocol` header |
| PBX parse error | Check Kamailio Contact header cleanup |
| Everything broken | Run instant recovery from [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md) |

**For detailed diagnosis and fixes, always refer to:** [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)

---

## 🏗️ System Architecture (High Level)

```
Browser (WSS) → Nginx → Kamailio → PBX (UDP)
                 ↓        ↓
              443/TLS   8443/WS   Normalize headers
              Bridge    Host      (WSS→UDP)
              Mode      Mode
```

**Key Points:**
- Nginx (bridge) reaches Kamailio (host) via Docker gateway `172.18.0.1`
- Kamailio translates WebSocket SIP to UDP SIP for PBX compatibility
- Via/Contact headers must be normalized (PBX doesn't understand WSS transport)

---

## ⚡ Emergency 5-Minute Recovery

If everything is broken:

```bash
cd /opt/webrtc-sbc

# 1. Restore nginx WebSocket proxy
cat > nginx/phone.srve.cc.conf << 'INNEREOF'
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
    proxy_pass http://172.18.0.1:8443;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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
INNEREOF

# 2. Verify .env
grep -E "PBX_IP|PBX_PORT" .env || cat >> .env << 'INNEREOF'
PBX_IP=testfusn.srve.cc
PBX_PORT=5060
INNEREOF

# 3. Verify kamailio header normalization
grep -q "subst_hf.*Via.*WSS" kamailio/kamailio.cfg || echo "⚠️ Restore kamailio.cfg from 1-REGISTRATION_FIX.md"

# 4. Restart
docker restart phone-nginx kamailio

# 5. Test (wait 5 sec then attempt browser registration)
sleep 5 && timeout 30 docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "WS SIP REGISTER"
```

**For complete recovery with explanations:** [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)

---

## 📋 What Was Fixed (Fix Batch 1)

| Component | Issue | Fix |
|-----------|-------|-----|
| **Nginx** | `proxy_pass` pointed to wrong IP | Changed to `http://172.18.0.1:8443` (Docker gateway) |
| **Kamailio** | Via header had `SIP/2.0/WSS` | Normalized to `SIP/2.0/UDP` in `route[RELAY_TO_PBX]` |
| **Kamailio** | Contact header had `;transport=ws;alias=...` | Stripped WebSocket params before PBX relay |
| **Docker** | Network mode mismatch caused connectivity issues | Documented: Kamailio=host, nginx=bridge |

**Complete details:** [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)

---

## 📁 Documentation Files

- **[1-README.md](1-README.md)** ← You are here (quick reference)
- **[1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)** ← Full guide (read this for any issue)

**Total:** 2 files to keep things simple and avoid duplication

---

## ✅ Success Check

When working correctly, you'll see:

```bash
# 1. Nginx logs show WebSocket upgrade
docker logs phone-nginx --tail 20 | grep "GET /ws"
# → "GET /ws HTTP/1.1" 101

# 2. Kamailio logs show REGISTER flow
docker logs kamailio --tail 50 | grep -E "WS SIP REGISTER|RELAY_TO_PBX"
# → WS SIP REGISTER received
# → RELAY_TO_PBX forwarded to PBX

# 3. Browser shows "Registered"
# Status: Registered (green)
```

---

**For all configuration details, troubleshooting, and recovery procedures:**  
**→ [1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md) ←**
