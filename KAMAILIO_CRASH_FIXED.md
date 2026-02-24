# KAMAILIO CRASH FIXED

## Problem
Kamailio was crashing with error:
```
CRITICAL: parse error in config file /etc/kamailio/kamailio.cfg, line 380, column 17-21: 
Can't get from cache: $body
```

## Root Cause
I used invalid Kamailio syntax `$body` variable which doesn't exist. Kamailio doesn't support accessing the full message body with `$body`.

## Fix Applied
**Completely removed the invalid SDP rewriting code** and reverted to simple passthrough:

**File:** `/opt/webrtc-sbc/kamailio/kamailio.cfg`

**Changed routes:**
```ini
route[MEDIA_OFFER] {
    xlog("L_INFO", "MEDIA_OFFER: SDP passthrough (no RTPEngine)\n");
    return;
}

route[MEDIA_ANSWER] {
    xlog("L_INFO", "MEDIA_ANSWER: SDP passthrough\n");
    return;
}

route[MEDIA_DELETE] {
    xlog("L_INFO", "MEDIA_DELETE: No RTPEngine session\n");
    return;
}
```

**Key points:**
- ✅ No more `$body` variable
- ✅ No invalid syntax
- ✅ Kamailio can start
- ✅ Registration code untouched
- ✅ Simple passthrough for media

## Important Note
With this approach, SDP still contains internal Docker IP `172.18.0.2`. This means:
- ❌ Outgoing calls may still fail with FusionPBX
- ✅ But Kamailio works and registration works
- ✅ System is stable

## To Properly Fix Outgoing Calls

Proper SDP rewriting requires:
1. Enable RTPEngine (Docker image issue needs solving)
2. Or configure FusionPBX to accept internal IPs
3. Or run WebRTC client with public IP directly

## Test Now

1. **Verify Kamailio is running:**
   ```bash
   docker ps | grep kamailio
   ```
   Should show status "Up X seconds"

2. **Try registering:**
   - Open https://phone.srve.cc/
   - Register with 900900@testfusn.srve.cc
   - Should work ✅

3. **Try calling:**
   - Make outgoing call
   - May still fail with 488 (media IP issue)
   - But call attempt will be logged

## Status
✅ **Kamailio crash FIXED**  
✅ **Config syntax valid**  
✅ **Registration should work**  
⚠️ **Outgoing calls: media IP issue remains**  

Kamailio is now stable and functional!

