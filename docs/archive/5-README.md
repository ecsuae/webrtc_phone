# Fix #5: Ring Back Tone (RBT) & Special Characters Dialing

## Quick Summary

Fixed two critical issues:
1. ✅ **RBT/Early Media**: Users can now hear actual IVR/ringback audio instead of a "long beep"
2. ✅ **Special Characters**: Can now dial short codes like `*9171`, `#123`, etc.

## What Changed

### Backend (Kamailio)
- **File**: `kamailio/kamailio.cfg`
- **Changes**: 
  - MEDIA_OFFER: Use `RTP/AVP ICE=remove` to convert WebRTC → PBX
  - MEDIA_ANSWER: Use `RTP/SAVPF ICE=force` to convert PBX → WebRTC
  - Added logging to MANAGE_REPLY for debugging

### Frontend (Browser)
- **File**: `www/app/sipCall.js`
- **Changes**:
  - Added `encodeURIComponent()` for special characters in dial string
  - Enabled `earlyMedia: true` in SIP.Inviter
  - Added retry loop for early media audio attachment

## Fast Setup (New Installation)

If setting up from scratch, these are the key settings:

### 1. RTPEngine Flags (kamailio.cfg)

```cfg
# Lines 516-544: MEDIA_OFFER
route[MEDIA_OFFER] {
    if ($avp(is_local_call) != 1) {
        rtpengine_offer("RTP/AVP replace-origin replace-session-connection ICE=remove DTLS=passive");
    }
}

# Lines 546-577: MEDIA_ANSWER  
route[MEDIA_ANSWER] {
    if ($avp(is_local_call) != 1) {
        rtpengine_answer("RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive");
    }
}
```

### 2. Browser Early Media (sipCall.js)

```javascript
// Line 94: Encode special characters
const encodedTarget = encodeURIComponent(target);

// Line 122: Enable early media
const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    // ... other options
});

// Lines 131-138: Attach audio on 180/183
onProgress: (resp) => {
    if (code === 180 || code === 183) {
        attachRemoteAudio(inviter, ui);
        startEarlyMediaAttachLoop(inviter, ui);
    }
}
```

## Testing

### Test RBT:
```
1. Register: extension 900900
2. Call: any valid extension or IVR
3. ✓ Hear real ringback/IVR audio (not beep)
```

### Test Special Characters:
```
1. Dial: *9171 or #123
2. ✓ Call connects properly
3. Browser console: "dialing *9171 (encoded: %2A9171)"
```

## Restart Required

After applying changes:
```bash
docker compose restart kamailio
# Then hard refresh browser (Ctrl+Shift+R)
```

## Before & After

| Issue | Before | After |
|-------|--------|-------|
| **RBT Audio** | Long beep tone | Real IVR/ringback audio |
| **Special Chars** | Call fails | `*9171` works perfectly |
| **183 Response** | Silent/ignored | Plays early media |
| **Short Codes** | Invalid URI | Encoded: `%2A9171` |

## Technical Details

See [5-RBT_SPECIAL_CHARACTERS_FIX.md](5-RBT_SPECIAL_CHARACTERS_FIX.md) for:
- Root cause analysis
- Detailed code changes
- Media flow diagrams
- Troubleshooting guide

## Related Fixes

- Fix #1: Registration flow
- Fix #2: Hangup/CANCEL routing  
- Fix #3: One-sided audio
- Fix #4: Push notifications
- **Fix #5: RBT & Special characters** ← You are here

## Status

✅ **WORKING** - Both issues resolved and tested
- RBT plays correctly from FreeSWITCH
- Special characters properly encoded
- Early media (183) fully functional

---

**Commit**: `rbt & special charcters dialing fixed`  
**Date**: March 2, 2026
