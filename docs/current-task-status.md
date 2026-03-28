# Current Task Status
_Last updated: 2026-03-29_

## Current task
Restore Wi-Fi to Wi-Fi two-way audio first.
Do not continue LTE audio work until Wi-Fi baseline is confirmed working again.

## Current known status

### Working
- Registration works
- Frontend diagnostics widget works
- Admin pages on WireGuard work:
  - `/dashboard`
  - `/diagnostics/errors`
  - `/admin/routing`
  - `/admin/calllogs`

### Not yet confirmed
- Wi-Fi to Wi-Fi two-way audio
- LTE to LTE audio
- LTE to Wi-Fi audio

## Runtime evidence so far
- Wi-Fi calls gather candidates successfully
- Admin call logs show Wi-Fi candidate presence such as:
  - `relay=0 host=2 srflx=1 total=3`
- Therefore Wi-Fi issue is not a TURN-unreachable problem
- Problem is in shared SIP/RTPEngine media handling

## Confirmed Wi-Fi regression cause
The active Wi-Fi one-sided-audio regression was traced to:
- `kamailio/routes/60-media.cfg`
- `MEDIA_ANSWER` else branch (outgoing call, PBX -> WebRTC answer path)

A later change had added extra RTPEngine flags:
- `rtcp-mux=answer`
- `codec-mask=PCMA`
- `codec-mask=PCMU`

This differed from the last known working state and is believed to cause asymmetric audio.

## Fix applied
`kamailio/routes/60-media.cfg` now restores the outgoing PBX->WebRTC answer path to:

`rtpengine_answer("RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive")`

Also note:
- the earlier `media-address=$env(KAM_PUBLIC_IP)` addition to shared PBX->WebRTC paths had already been reverted
- frontend LTE guard code was NOT identified as the Wi-Fi regression cause

## Restart status
Kamailio was restarted at ~02:41 AM PKT 2026-03-29 (after fix was written at 02:37).
The fix is **live** in the running container.

**Next step: test a Wi-Fi to Wi-Fi call.**

If the call is still one-sided after confirming two browsers are registered:
- Check browser console on the CALLEE side for `[incoming:media]` log lines
- Look for: "Remote audio bound to audio element" and "Audio playing"
- If these are absent, the track is not reaching `bindAndPlay`
- If present but audio is silent, run `document.getElementById('remoteAudio').volume` in devtools

## Archived: Restart command
```bash
docker compose restart kamailio