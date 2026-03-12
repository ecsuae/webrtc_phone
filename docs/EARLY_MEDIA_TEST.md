# Early Media Troubleshooting Guide

## Problem Summary
- **Issue**: Outgoing calls are silent until they connect (no ringback/IVR audio)
- **Normal SIP client**: Hears ringback properly
- **WebRTC client**: Silent until 200 OK

## Root Cause Analysis

The issue is likely ONE of these:

### 1. **PBX Not Sending Early Media with SDP (180/183)**
Your PBX sends `180 Ringing` **WITHOUT** SDP body. This is normal.

**Evidence**: Check logs:
```bash
docker-compose logs --since=10m kamailio 2>&1 | grep "MANAGE_REPLY.*180\|SDP found\|NO SDP"
```

Expected output:
```
MANAGE_REPLY: status=180 ... NO SDP body detected  ← No media in 180
```

### 2. **Early Media Sessions Not Being Set Up in RTPEngine**
If PBX DOES send 183 with SDP, rtpengine must process it.

**Check**:
```bash
docker-compose logs --since=10m kamailio 2>&1 | grep "183\|MEDIA_ANSWER.*early\|rtpengine_answer"
```

### 3. **Browser Not Playing Early Media Streams**
Even if rtpengine processes it, browser must attach the stream.

**Check Browser Console** (`F12`):
```javascript
// Should see:
[PROGRESS] 183 Session Progress: WITH SDP
[EARLY-MEDIA] Remote audio stream attached
```

---

## Testing Steps

### Step 1: Make Test Call with Logging Enabled

1. **Open browser DevTools**: `F12` → Console tab
2. **Enable All Logging**:
   ```javascript
   // In browser console:
   localStorage.setItem("logLevel", "debug");
   location.reload();
   ```
3. **Make outgoing call to extension** (e.g., 100)
4. **Check console for key messages**:
   - `[PROGRESS] 180 Ringing` ← Sent by PBX
   - `[PROGRESS] 183 Session Progress:` ← With or without SDP?
   - `[EARLY-MEDIA] Remote audio stream attached` ← If media arrives
   - `[RINGBACK AUDIO] Starting outbound ringback` ← Local tone generator

### Step 2: Check Server Logs

```bash
# Watch for early media handling in real-time:
docker-compose logs -f kamailio 2>&1 | grep -E "MANAGE_REPLY.*18|SDP|MEDIA_ANSWER|rtpengine" &

# Then make a test call from browser
```

**What to look for:**
- 180 responses (normal, may have no SDP)
- 183 responses (check if SDP is present)
- `rtpengine_answer` calls (should happen for responses with SDP)

### Step 3: Compare with Normal SIP Client

Make the SAME call with a regular SIP client (e.g., Linphone, Zoiper):

```bash
# Capture what a regular SIP client receives:
docker-compose exec kamailio tcpdump -i eth0 'port 5060 and (host <your-client-ip>)'
```

---

## Solutions

### Solution 1: Increase Local Ringback Volume ✓ ALREADY DONE

We already increased the tone from 0.08 to 0.3 volume (30% of max).

**Status**: Changed in `/opt/webrtc-sbc/www/app/outgoing/ringback.js`

### Solution 2: Request Early Media from PBX

If PBX supports early media but isn't sending it automatically, try adding:

**Add to outgoing call INVITE**:
```
Require: 100rel
Supported: 100rel
```

**Or configure PBX** to always send early media for WebRTC clients.

### Solution 3: Enable PRACK (100rel) in Kamailio

If PBX sends 183 with SDP, we may need to handle PRACK responses:

```kamailio
# In kamailio.cfg outgoing section:
route[HANDLE_OUTGOING_CALL] {
    # ... existing code ...
    
    # Require 100rel for reliable provisional responses
    append_hf("Require: 100rel\r\n");
    append_hf("Supported: 100rel\r\n");
}
```

### Solution 4: Check PBX Early Media Settings

Contact your PBX administrator to verify:
1. **Early media is enabled** for the domain/user
2. **183 responses are being sent** (not just 180)
3. **SDP is included in 183** responses
4. **RTPEngine can reach PBX media** (check rtpengine.conf)

---

## Diagnostic Output

Run this to capture everything:

```bash
# 1. Start new logs
docker-compose logs --tail=0 -f kamailio > /tmp/kamailio-debug.log 2>&1 &
LOGPID=$!

# 2. Make test call from browser (wait ~15 seconds)

# 3. Kill logging
kill $LOGPID

# 4. Analyze
grep -E "HANDLE_OUTGOING|MEDIA_OFFER|180|183|MANAGE_REPLY|SDP|MEDIA_ANSWER|rtpengine" /tmp/kamailio-debug.log
```

---

## Expected Behavior After Fix

### Outgoing to Extension (100)
```
Browser → 180 Ringing (local tone plays)
         → 183 with SDP (if PBX supports) OR 200 OK (call connects)
         → Audio works
```

### Outgoing to External Number
```
Browser → 180 Ringing (local tone plays)
         → IVR/Ringback from destination (if SDP in 183) OR 200 OK
         → Audio works
```

---

## Next Steps

1. ✅ **Already done**: Increased local ringback volume (0.08 → 0.30)
2. ✅ **Already done**: Added better early media handling in rtpengine
3. ✅ **Already done**: Improved browser logging
4. **TODO**: Verify what PBX is actually sending (run test above)
5. **TODO**: If needed, configure PBX or Kamailio for early media support

---

## Questions for PBX Vendor

If issue persists after Step 2 testing, ask your PBX:

- "Does PBX send **183 Session Progress** with SDP for WebRTC calls?"
- "Is early media **enabled** for this domain?"
- "What is the **early media timeout**?"
- "Should we send **Require: 100rel** or **Supported: 100rel** header in INVITE?"

