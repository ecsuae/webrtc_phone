# 11 - MOH Fixed (Hold/Unhold Call Controls)

## Summary
This document captures the final working fix for call controls where:
- Hold plays MOH correctly.
- Unhold resumes two-way audio correctly.
- Calls do not disconnect on hold/unhold renegotiation.

## Symptoms We Had
- Hold could work, but unhold had no audio (`rtp recv=0`).
- Sometimes hold caused immediate disconnect with SDP direction errors.
- Recovery re-INVITE was accepted but media still did not return.

## Final Root Cause
Two issues combined:
1. Frontend hold logic was too aggressive in media-direction handling during renegotiation.
2. Kamailio in-dialog re-INVITEs (hold/unhold) were relayed without full RTPEngine re-anchoring in some paths.

Because of that, after hold/unhold, media could shift to an unusable path and browser RTP receive stayed at zero.

## What Fixed It

### 1) Isolated and stabilized hold control logic (frontend)
Use a dedicated hold module and avoid mutating transceiver directions directly.

Key files:
- `www/app/features/sipHold.js`
- `www/app/ui/callControls.js`

Important behavior:
- Hold uses SIP re-INVITE with hold modifier (`a=sendonly`) and codec safety modifier.
- Unhold uses SIP re-INVITE without forced transceiver direction mutation.
- Post-unhold RTP check runs and triggers one recovery re-INVITE (ICE restart) only when needed.
- Hold button state is updated only after successful signaling.

### 2) Keep SDP codec filtering safe
Do not allow DTMF-only audio m-lines.

Key file:
- `www/app/sdp.js`

Rule:
- Keep `telephone-event` only alongside at least one real audio codec (PCMU/PCMA).
- If no real codec remains, keep original SDP unchanged.

### 3) Re-anchor media for in-dialog hold/unhold re-INVITEs (Kamailio)
Apply RTPEngine offer/answer handling for in-dialog INVITE/UPDATE as well.

Key file:
- `kamailio/routes/30-dialog-relay.cfg`

Added logic in `route[WITHIN_DIALOG]`:
- For `INVITE|UPDATE`: set `t_on_reply("MANAGE_REPLY")`.
- If SDP body exists: call `route(MEDIA_OFFER)` before relay.

This ensures hold/unhold renegotiation stays anchored through RTPEngine and media returns after unhold.

## Operational Step
After config change, restart Kamailio:

```bash
docker compose restart kamailio
```

## Verification Checklist
1. Start outbound call and confirm two-way audio.
2. Press Hold and confirm MOH is heard.
3. Press Unhold and confirm remote audio returns.
4. Check logs:
   - No `Incompatible receive direction` errors.
   - RTP receive counter increases after unhold.

## Relevant Files
- `www/app/features/sipHold.js`
- `www/app/ui/callControls.js`
- `www/app/sdp.js`
- `www/app/outgoing/media.js`
- `kamailio/routes/30-dialog-relay.cfg`
- `kamailio/routes/40-replies.cfg`
- `kamailio/routes/60-media.cfg`
