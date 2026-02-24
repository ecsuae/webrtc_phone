# Configuration Update: Changed SIP Server Domain to testfusn.srve.cc

## ✅ What Changed in .env

```bash
BEFORE:
  DOMAIN=phone.srve.cc           # Browser access domain
  PUBLIC_IP=38.242.157.239       # Kamailio advertised IP (from phone.srve.cc)
  PBX_IP=85.235.64.159           # SIP Server (old IP address)
  PBX_PORT=5060

AFTER:
  DOMAIN=phone.srve.cc           # Browser access domain (UNCHANGED)
  PUBLIC_IP=38.242.157.239       # Kamailio advertised IP (UNCHANGED - from phone.srve.cc)
  PBX_IP=testfusn.srve.cc        # SIP Server domain (CHANGED from IP to domain)
  PBX_PORT=5060
```

---

## 🔑 Key Points

### DOMAIN=phone.srve.cc
- **Browser accesses**: https://phone.srve.cc ✅
- **Public IP**: 38.242.157.239 (DNS resolves phone.srve.cc to this IP)
- **Used by**: Nginx web server

### PUBLIC_IP=38.242.157.239
- **What Kamailio advertises** in SIP headers (Via, Contact)
- **Source**: Resolves from phone.srve.cc (your WAN/public IP)
- **Unchanged**: Still 38.242.157.239
- **FusionPBX sees**: This IP in SIP headers

### PBX_IP=testfusn.srve.cc
- **SIP/FusionPBX server domain** (changed from 85.235.64.159 IP)
- **SIP registrations forwarded to**: testfusn.srve.cc
- **DNS resolves**: testfusn.srve.cc to actual FusionPBX server IP
- **This is the SIP domain**, not the browser domain

---

## 📋 How It Works

```
┌─────────────────────────────────────────────────────┐
│  Browser Access                                     │
│  https://phone.srve.cc (resolves to 38.242.157.239)│
└─────────────────────────────────────────────────────┘
           │
           ├─────→ Loads WebRTC Phone UI
           │
           └─────→ User enters SIP Domain:
                   • Domain: testfusn.srve.cc (for SIP)
                   • Extension: 122202096
                   • Password: ***

┌─────────────────────────────────────────────────────┐
│  SIP Registration                                   │
│  sip:122202096@testfusn.srve.cc                     │
└─────────────────────────────────────────────────────┘
           │
           ├─→ Kamailio receives on wss://phone.srve.cc:8443
           │
           ├─→ Advertises IP: 38.242.157.239 (public IP of Kamailio)
           │
           ├─→ Forwards to: testfusn.srve.cc (SIP server domain)
           │                (DNS resolves testfusn.srve.cc to FusionPBX)
           │
           └─→ FusionPBX registers: sip:122202096@testfusn.srve.cc
               Sees IP: 38.242.157.239 (your Kamailio server)
```

---

## 🚀 Restart Instructions

```bash
cd /opt/webrtc-sbc && \
docker compose down && \
docker compose up -d && \
docker compose ps
```

---

## ✅ After Restart - What to Test

### Test 1: Browser Access (Same as Before)
```bash
# Should load the WebRTC UI
https://phone.srve.cc
```

### Test 2: SIP Registration (SIP Domain Changed)
```
In WebRTC Phone UI:
  Domain: testfusn.srve.cc    (THIS IS THE SIP SERVER DOMAIN - CHANGED)
  WSS Host: phone.srve.cc      (UNCHANGED - browser domain)
  Extension: 122202096
  Password: (your password)
  
Click: Connect + Register
```

### Test 3: Verify Kamailio Logs
```bash
docker logs kamailio | grep -i "relay_to_pbx"
# Should show: RELAY_TO_PBX via udp to testfusn.srve.cc:5060
```

---

## ⚠️ Summary

| Item | Old | New | Purpose |
|------|-----|-----|---------|
| **DOMAIN** | phone.srve.cc | phone.srve.cc | Browser webphone URL (unchanged) |
| **PUBLIC_IP** | 38.242.157.239 | 38.242.157.239 | Kamailio advertised IP (unchanged) |
| **PBX_IP** | 85.235.64.159 | testfusn.srve.cc | SIP Server domain (changed from IP to domain) |

---

## 🎯 Clear Distinction

**Browser Domain** (Web Access):
- `phone.srve.cc` → resolves to → `38.242.157.239` → HTTPS/WebRTC UI

**SIP Domain** (Registration):
- `testfusn.srve.cc` → resolves to → FusionPBX server → SIP registration

These are completely separate and serve different purposes!



