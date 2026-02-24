# FIX APPLIED: Outgoing Calls - SDP Rewriting for Public IP

## Problem
When making outgoing calls, FusionPBX receives SDP with internal Docker IP `172.18.0.2` and rejects the call with error 488 (INCOMPATIBLE_DESTINATION).

FusionPBX Log shows:
```
[DEBUG] switch_core_media.c:4307 sofia/internal/900900@testfusn.srve.cc 
no suitable candidates found.
```

## Root Cause
The SDP (media offer) from WebRTC client contains:
```
c=IN IP4 172.18.0.2                  ❌ Internal Docker IP
a=candidate:... 172.18.0.2:55275 typ relay  ❌ Internal IP
```

FusionPBX can't reach `172.18.0.2` from outside, so it rejects the call.

---

## Solution Applied

Modified **ONLY** the `route[MEDIA_OFFER]` section to rewrite SDP for INVITE messages:

**File:** `/opt/webrtc-sbc/kamailio/kamailio.cfg`

**What it does:**
1. Detects when INVITE message has SDP
2. Finds lines with `172.18.0.2`
3. Replaces with public IP `38.242.157.239`
4. Forwards modified SDP to FusionPBX

**Example transformation:**
```
BEFORE: c=IN IP4 172.18.0.2         ❌ (internal)
AFTER:  c=IN IP4 38.242.157.239     ✅ (public)
```

---

## Important: REGISTER NOT TOUCHED

**CRITICAL:** The REGISTER routing code is completely untouched:

```ini
# REGISTER
if (is_method("REGISTER")) {
    route(FIX_NAT_REGISTER);
    add_path_received();
    route(RELAY_TO_PBX);
    exit;
}
```

**The SDP rewriting ONLY happens for INVITE messages**, not REGISTER. This keeps registration working while fixing calls.

---

## Call Flow with Fix

```
Browser calls 096045945060
  ↓ Sends INVITE with SDP
  ↓ SDP contains: c=IN IP4 172.18.0.2 (internal)
  
Kamailio (INVITE received)
  ↓ Detects INVITE with SDP
  ↓ route[MEDIA_OFFER] called
  ↓ Rewrites: 172.18.0.2 → 38.242.157.239 ✅
  
FusionPBX (receives rewritten SDP)
  ↓ Sees: c=IN IP4 38.242.157.239 ✓
  ↓ Public IP is reachable ✓
  ↓ Accepts call ✅
  ↓ Call connects
```

---

## Test Now

1. **Registration** should still work (untouched code)
2. **Make outgoing call** to 096045945060
3. **Call should connect** (no 488 error)
4. **Audio should work** (media flows via public IP)

---

## Verification

**Check Kamailio is running:**
```bash
docker ps | grep kamailio
```

**Check for errors:**
```bash
docker logs kamailio 2>&1 | grep -i "error"
```

Should be no errors.

---

## What Changed

### ONLY in MEDIA_OFFER route:
- ✅ Added SDP rewriting logic
- ✅ Replaces 172.18.0.2 with public IP
- ✅ Only for INVITE messages (calls)
- ✅ Does NOT affect REGISTER

### Everything else:
- ✅ REGISTER code: UNCHANGED
- ✅ WebSocket handling: UNCHANGED
- ✅ Other routing: UNCHANGED

---

## Summary

✅ **Problem:** SDP contains unreachable Docker IP  
✅ **Solution:** Rewrite SDP with public IP for INVITE only  
✅ **Status:** Applied and Kamailio restarted  
✅ **Registration:** Protected (not touched)  
✅ **Ready to test:** Try making a call now  

---

**Try calling now - it should work!**

If issues occur, check FusionPBX logs to confirm it's receiving the rewritten SDP with public IP.

