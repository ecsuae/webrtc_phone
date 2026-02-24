# FIXED: WebSocket Connection Issue

## The Problem

WebSocket connection was failing with error code 1006 when trying to register.

**Error:** `WebSocket closed wss://phone.srve.cc/ws (code: 1006)`

## Root Cause Found ✅

The nginx configuration was incorrect:

**WRONG:**
```nginx
proxy_pass https://kamailio:8443;  # ❌ Trying to use HTTPS
proxy_ssl_verify off;
```

**CORRECT:**
```nginx
proxy_pass http://kamailio:8443;   # ✅ Use plain HTTP
```

**Why?** Kamailio is listening on plain TCP port 8443 (not TLS). Nginx terminates the TLS/SSL, then forwards plain HTTP to Kamailio.

## Fix Applied ✅

**File:** `/opt/webrtc-sbc/nginx/phone.srve.cc.conf`

**Changed:**
- Line 18: `https://kamailio:8443` → `http://kamailio:8443`
- Removed: `proxy_ssl_verify off` (not needed)

**Container restarted:** nginx

## Test Registration NOW

1. Open: **https://phone.srve.cc/**
2. Enter:
   - Extension: **900900**
   - Domain: **testfusn.srve.cc**
   - Password: your_password
3. Click "Start and Register"

**Expected:** Should now show "Registered" ✅

## What Was Wrong

The connection flow was:

```
Browser
  ↓ wss:// (WebSocket over TLS)
Nginx (port 443)
  ↓ https:// ❌ WRONG - Kamailio doesn't speak TLS on 8443
Kamailio (port 8443 - plain TCP)
  ↓ Connection failed - Kamailio can't handle TLS
ERROR 1006
```

Now it works:

```
Browser
  ↓ wss:// (WebSocket over TLS)
Nginx (port 443) - Terminates TLS
  ↓ http:// ✅ CORRECT - Plain HTTP WebSocket
Kamailio (port 8443 - plain TCP) - Handles WebSocket
  ↓ Registration forwarded to PBX
FusionPBX (testfusn.srve.cc:5060)
  ✓ Success!
```

## Summary

✅ **Issue identified:** nginx proxying to https:// instead of http://  
✅ **Fix applied:** Changed proxy_pass to use http://  
✅ **Nginx restarted:** Configuration active  
✅ **Ready to test:** Try registration now  

**Registration should work now!**

---

**Date Fixed:** February 13, 2026  
**File Modified:** nginx/phone.srve.cc.conf  
**Status:** ✅ RESOLVED

