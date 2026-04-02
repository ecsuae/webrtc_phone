# NOW

## Current task
TASK-025 — Admin call logs summary: restore missing inbound AUDIO compact row, macOS CLIENT row, and enhance decode/RCA visibility.

## Why this matters
The admin call logs summary is a critical diagnostic tool for troubleshooting media issues. Currently missing inbound AUDIO compact row and macOS CLIENT row limit observability. Incomplete decode/RCA fields (decoderImplementation, totalSamplesDecoded, packetsRepaired, jitterBufferDelay, jitterBufferEmittedCount) hinder root cause analysis of Android decode/render/output quality issues.

## Already proven
- CALL rows, ICE rows, outbound AUDIO rows, receive-render-proof rows (Render[early], Render[5s], Render[10s]) are working.
- Outbound selected-pair compact ICE detail and outbound RTP/render RCA fields are visible (recv/sent, audioLevel, totalAudioEnergy, codec, concealed).
- Hidden rows (call-log-post-buffered, profile-badge-rendered) stay hidden as intended.
- Android/outbound receives RTP, ICE/DTLS healthy, playback element active, codec visible, concealment high, energy tiny.

## Current blocker
1. Inbound AUDIO compact row is missing from summary.
2. macOS CLIENT row is missing.
3. Decode/RCA visibility partial: missing decoderImplementation, totalSamplesDecoded, packetsRepaired, jitterBufferDelay, jitterBufferEmittedCount.
4. Logging reliability if call-log-post-failed is still involved.

## Required focus
- Restore missing existing rows only (inbound AUDIO compact, macOS CLIENT).
- Enhance decode/RCA visibility only if already emitted or safely ingestible.
- Logging reliability only after A/B are understood.
- Do not refactor summary pipeline, rewrite from backup, change raw-view behavior, remove existing working summary rows.
- Do not mix logging work with speaker/earpiece/render/binding/registration/bootstrap/module-loading changes.

## Do not touch
- Registration logic
- Outgoing/incoming signaling flow (except logging events)
- Media negotiation
- Speakerphone, earpiece, remote audio binding
- Bootstrap, module loading
- Currently working summary rows (CALL, ICE, outbound AUDIO, receive-render-proof, outbound selected-pair compact ICE detail, outbound RTP/render RCA fields)
- Hidden rows (call-log-post-buffered, profile-badge-rendered)

## Files most likely involved
- `push-server/src/admin/callLogPage.js` (summary rendering)
- `push-server/src/services/callLogStore.js` (event ingestion)
- `www/app/features/callMediaLog.js` (frontend media log events)
- `www/app/pc/stats.js` (WebRTC stats collection)
- `www/app/pc/bind.js` (stats binding)
- `www/app/ui/appUi.js` (UI events)

## Exact next safe step
1. Inspect current summary rendering logic to identify why inbound AUDIO compact row is missing.
2. Determine if macOS CLIENT row emission is missing from frontend or filtered out in summary.
3. Check if decode/RCA fields are being collected in stats but not included in summary.
4. Apply smallest patch to restore missing rows only, ensuring all currently working summary rows remain unchanged.

## Verification rule
For this logging/backend-storage/dashboard change, verify on:
- Existing call logs that show outbound AUDIO rows but missing inbound AUDIO rows.
- macOS client logs (if available) to confirm CLIENT row appears after fix.
- Android decode stats to confirm new fields appear in summary when available.