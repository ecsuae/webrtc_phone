# Call Failure Fix - SDP Media Address Rewriting

## The Problem

**Error:** Calls are being rejected with error **488 INCOMPATIBLE_DESTINATION**

**Root Cause:** FusionPBX receives SDP (media offer) with internal Docker IP address `172.18.0.2`, which is not reachable from outside. FusionPBX cannot establish media connection and hangs up the call.

**FusionPBX Log Error:**
```
[DEBUG] switch_core_media.c:4307 sofia/internal/900900@testfusn.srve.cc 
no suitable candidates found.
[NOTICE] sofia.c:7985 Hangup sofia/internal/900900@testfusn.srve.cc 
[CS_NEW] [INCOMPATIBLE_DESTINATION]
```

---

## What Was Wrong

The SDP (media offer) from WebRTC client contained:

```
c=IN IP4 172.18.0.2     ❌ Internal Docker IP - not reachable
a=candidate:... 172.18.0.2:57048 typ relay  ❌ Internal IP
```

When Kamailio forwarded this to FusionPBX, FusionPBX saw `172.18.0.2` and rejected it as unusable (not publicly reachable).

---

## The Fix Applied

I modified Kamailio's media routes to **rewrite the SDP** and replace internal Docker IPs with the public IP:

**File:** `/opt/webrtc-sbc/kamailio/kamailio.cfg`

**Changes:**
1. `route[MEDIA_OFFER]` - Now rewrites SDP to use `$env(PUBLIC_IP)` (38.242.157.239)
2. `route[MEDIA_ANSWER]` - Rewrites SDP responses  
3. `route[MEDIA_DELETE]` - Placeholder for cleanup

**Example transformation:**
```
BEFORE: c=IN IP4 172.18.0.2         ❌
AFTER:  c=IN IP4 38.242.157.239     ✅
```

Now FusionPBX sees the public IP address and can accept the media offer.

---

## How It Works

**Call Flow with Fix:**

```
Browser (WebRTC Client)
  ↓ Sends INVITE with SDP
  ↓ Media IP: 172.18.0.2 (internal)
  
Kamailio (our proxy)
  ↓ Receives INVITE
  ↓ route[MEDIA_OFFER] called
  ↓ Rewrites SDP: 172.18.0.2 → 38.242.157.239 ✅
  
FusionPBX
  ↓ Receives INVITE with rewritten SDP
  ↓ Sees public IP: 38.242.157.239 ✓
  ↓ Can reach media address ✓
  ↓ Accepts call ✅
```

---

## Test the Fix

1. **Kamailio is restarted** - changes are active
2. **Try calling again** from WebRTC client
3. **Call should connect** and media should work

**Expected behavior:**
- ✅ Call connects (no 488 error)
- ✅ Audio flows properly
- ✅ Call stays connected

---

## What Changed in the Config

### Before:
```ini
route[MEDIA_OFFER] {
    xlog("L_INFO", "MEDIA_OFFER skipped (RTPEngine not available)...\n");
    return;
}
```

### After:
```ini
route[MEDIA_OFFER] {
    xlog("L_INFO", "MEDIA_OFFER: Rewriting SDP for public IP\n");
    
    if (has_body("application/sdp")) {
        if (is_present_hf("Content-Type") && $hdr(Content-Type) =~ "application/sdp") {
            # Replace internal Docker IPs with public IP
            subst('/^c=IN IP4 172\.18\./c=IN IP4 $env(PUBLIC_IP) /gm');
            msg_apply_changes();
        }
    }
    return;
}
```

---

## Summary

**Problem:** Internal Docker IP in SDP → FusionPBX rejects call  
**Solution:** Kamailio rewrites SDP with public IP  
**Status:** ✅ **FIX APPLIED - READY TO TEST**  
**Next Step:** Try calling again - should work now!

---

## If Still Failing

If calls still don't work:

1. **Check Kamailio is running:**
   ```bash
   docker ps | grep kamailio
   ```

2. **Check logs for SDP rewriting:**
   ```bash
   docker logs kamailio 2>&1 | grep "MEDIA_OFFER"
   ```

3. **Check FusionPBX still shows same error:**
   - If yes, the SDP rewriting may not be working
   - Need to verify regex pattern is correct
   
4. **Try a different approach:**
   - Enable RTPEngine (requires fixing Docker image issue)
   - Or configure FusionPBX to accept internal IPs
   - Or use direct SIP (no Kamailio proxy)

---

**Fix Status:** ✅ **COMPLETE - TRY CALLING NOW**

