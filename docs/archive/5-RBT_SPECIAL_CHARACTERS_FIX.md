# Ring Back Tone (RBT) & Special Characters Fix

## Issue Summary

**Problem 1**: During outbound calls, users heard a "long beep" instead of actual IVR/ring-back audio from FreeSWITCH during early media (183 Session Progress).

**Problem 2**: Could not dial short codes containing special characters like `*9171` or `#123`.

## Root Causes

### RBT Issue
- **Incorrect rtpengine flags**: Used simplified flags that didn't properly convert between WebRTC (SRTP/ICE/DTLS) and PBX (plain RTP)
- The 183 response from FreeSWITCH contained audio, but RTPEngine wasn't configured to properly bridge the media codecs and encryption
- Browser received audio data but it was the wrong format/not properly decoded

### Special Characters Issue
- Special characters like `*` and `#` were not being URL-encoded in SIP URIs
- SIP.js failed to create valid URIs with raw special characters
- FreeSWITCH rejected or couldn't process improperly formatted URIs

## Solutions Applied

### 1. RBT Fix - RTPEngine Configuration (kamailio.cfg)

**Location**: `/opt/webrtc-sbc/kamailio/kamailio.cfg`

#### OFFER Route (Browser → PBX)
```cfg
route[MEDIA_OFFER] {
    # For WebRTC-to-PBX calls
    if ($avp(is_local_call) != 1) {
        # Convert WebRTC (SRTP/ICE/DTLS) to plain RTP for PBX
        if (rtpengine_offer("RTP/AVP replace-origin replace-session-connection ICE=remove DTLS=passive")) {
            xlog("L_INFO", "rtpengine_offer() SUCCESS (webrtc-pbx)\n");
        }
    }
}
```

**Changes**:
- **RTP/AVP**: Force plain RTP profile for PBX side (remove SRTP/encryption)
- **ICE=remove**: Strip ICE candidates (PBX doesn't use ICE)
- **DTLS=passive**: Handle DTLS on WebRTC side
- **replace-origin**: Rewrite SDP origin to server IP
- **replace-session-connection**: Rewrite connection line to server IP

#### ANSWER Route (PBX → Browser)
```cfg
route[MEDIA_ANSWER] {
    # For WebRTC-to-PBX calls
    if ($avp(is_local_call) != 1) {
        # Convert PBX answer (plain RTP) back to WebRTC (SRTP/ICE/DTLS)
        if (rtpengine_answer("RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive")) {
            xlog("L_INFO", "rtpengine_answer() SUCCESS (webrtc-pbx)\n");
        }
    }
}
```

**Changes**:
- **RTP/SAVPF**: Convert to WebRTC-compatible profile (SRTP + ICE)
- **ICE=force**: Inject ICE candidates for browser
- **DTLS=passive**: Setup DTLS encryption
- **replace-origin**: Rewrite SDP origin to server IP
- **replace-session-connection**: Rewrite connection line to server IP

#### MANAGE_REPLY Verification
```cfg
onreply_route[MANAGE_REPLY] {
    xlog("L_INFO", "=== MANAGE_REPLY ENTERED: status=$rs from $si:$sp proto=$proto method=$rm ===\n");
    
    # Process 183 Session Progress with SDP
    if (status=~"18[0-9]|2[0-9][0-9]") {
        if (has_body("application/sdp")) {
            xlog("L_INFO", "MANAGE_REPLY: SDP found, calling MEDIA_ANSWER\n");
            route(MEDIA_ANSWER);
        }
    }
}
```

**Changes**:
- Added logging to confirm MANAGE_REPLY is triggered
- Ensures 183 responses with SDP are properly processed
- Calls MEDIA_ANSWER to bridge PBX audio to browser

### 2. Browser-Side Early Media Support (sipCall.js)

**Location**: `/opt/webrtc-sbc/www/app/sipCall.js`

#### Enable Early Media Negotiation
```javascript
const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,  // NEW: Enable 183 early media handling
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: localStream || undefined,
    },
});
```

#### Early Media Attachment Loop
```javascript
function startEarlyMediaAttachLoop(session, ui) {
    if (session.__earlyMediaAttachTimer) return;
    let attempts = 0;
    session.__earlyMediaAttachTimer = setInterval(() => {
        attempts += 1;
        attachRemoteAudio(session, ui);
        if (session?.state === "Terminated" || attempts >= 40) {
            clearInterval(session.__earlyMediaAttachTimer);
            session.__earlyMediaAttachTimer = null;
        }
    }, 250);
}
```

#### OnProgress Handler
```javascript
inviter.delegate = {
    onProgress: (resp) => {
        const code = resp?.message?.statusCode || resp?.statusCode;
        if (code === 180 || code === 183) {
            logLine(`[${nowISO()}] [call] Provisional response (${code}) - attaching early media`);
            attachRemoteAudio(inviter, ui);
            startEarlyMediaAttachLoop(inviter, ui);
        }
    },
};
```

### 3. Special Characters Fix (sipCall.js)

**Location**: `/opt/webrtc-sbc/www/app/sipCall.js`

```javascript
export async function startCall(SIP, st, ui) {
    const target = ui.dial();
    const domain = ui.domain();
    
    // NEW: Encode special characters like * # etc. for SIP URI
    const encodedTarget = encodeURIComponent(target);
    const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
    
    logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);
    // ...
}
```

**What this does**:
- `*` becomes `%2A`
- `#` becomes `%23`
- Other special characters are properly URL-encoded
- SIP.js can now create valid URIs
- FreeSWITCH properly receives and processes short codes

## Verification

### Test RBT
1. Register extension
2. Call any extension or IVR number
3. You should now hear:
   - Real ringback tone (not a beep)
   - IVR prompts during early media
   - Audio plays immediately when 183 is received

### Test Special Characters
1. Register extension
2. Dial `*9171` or other feature codes
3. Call should connect properly
4. Browser console shows: `dialing *9171 (encoded: %2A9171)`

## Technical Details

### Media Flow
```
Browser (WebRTC)     Kamailio/RTPEngine          FreeSWITCH (PBX)
================     ==================          ================
SRTP/ICE/DTLS   <->  Media Bridge         <->   RTP/AVP
  (encrypted)        (RTPEngine)               (plain audio)
```

### SDP Transformation Example

**Browser OFFER (to PBX)**:
- IN: `m=audio 49196 UDP/TLS/RTP/SAVPF 0 8` (WebRTC)
- OUT: `m=audio 30870 RTP/AVP 0 8` (Plain RTP for PBX)

**PBX ANSWER (183 or 200)**:
- IN: `m=audio 25824 RTP/AVP 0` (Plain RTP from PBX)
- OUT: `m=audio 30870 RTP/SAVPF 0` (WebRTC for browser)

## Files Modified

1. `/opt/webrtc-sbc/kamailio/kamailio.cfg`
   - Lines 516-544: MEDIA_OFFER route
   - Lines 546-577: MEDIA_ANSWER route
   - Line 447: Added MANAGE_REPLY logging

2. `/opt/webrtc-sbc/www/app/sipCall.js`
   - Line 94: Added encodeURIComponent for special characters
   - Line 122: Added `earlyMedia: true` to Inviter
   - Lines 58-66: Added startEarlyMediaAttachLoop
   - Lines 131-138: OnProgress handler for early media

3. `/opt/webrtc-sbc/www/app/media.js`
   - Lines 18-36: Enhanced mic access logging

## Rollback Instructions

If you need to revert these changes:

```bash
cd /opt/webrtc-sbc
git log --oneline | head -5  # Find the commit hash before this fix
git revert <commit-hash>
docker compose restart kamailio
# Hard refresh browser (Ctrl+Shift+R)
```

## Performance Impact

- **Minimal**: RTPEngine already bridges media; we just corrected the flags
- **No latency added**: Early media now plays immediately (previously was broken)
- **CPU**: No significant change
- **Memory**: Negligible (one additional timer per call for early media loop)

## Known Limitations

1. **Early media works only for audio** - video not tested/supported
2. **G.711 codec only** - as configured in g711OnlyModifier
3. **Special character encoding** - May need adjustment for international characters beyond URL encoding

## Troubleshooting

### Still hearing beep instead of RBT?
```bash
# Check if rtpengine operations succeed
docker compose logs kamailio --since 1m | grep "rtpengine_answer"
# Should see: "rtpengine_answer() SUCCESS"
```

### Special character dialing fails?
```javascript
// Check browser console for encoded URI
// Should see: [call] dialing *9171 (encoded: %2A9171)
```

### No audio at all?
```bash
# Check RTPEngine is receiving/forwarding packets
docker compose logs rtpengine --since 1m | grep "Forward to sink"
```

## References

- RTPEngine documentation: https://github.com/sipwise/rtpengine
- SIP.js early media: https://sipjs.com/api/0.21.0/classes/Inviter.html
- RFC 3960: Early Media and Ringing Tone Generation
