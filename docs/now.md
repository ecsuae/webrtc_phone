# NOW

## Current task
TASK-024 — UI: restore in-call RX/TX packet indicators (live bars/counters during a call).

## Why this matters
The in-call RX/TX packet indicators are a key live diagnostic and user confidence signal during a call. They previously worked and were lost during refactors/upgrades.

## Already proven
- WebRTC stats collection exists (`RTCPeerConnection.getStats()`), but there is no active UI binding rendering live RX/TX bars/counters.

## Current blocker
The call UI no longer contains or updates the in-call RX/TX packet indicator elements.

## Required focus
- Fix only the UI/telemetry path for in-call RX/TX indicators.
- Do not change registration.
- Do not change outgoing/incoming signaling flow except if required for packet UI only.
- Do not change media negotiation.
- Do not change admin/export/PDF logic.

## Do not touch
- registration logic
- outgoing/incoming call logic (except UI telemetry hookup only)
- LTE/Wi-Fi media path logic
- admin call logs/export/PDF logic
- service worker / cache versioning
- Kamailio / rtpengine / coturn / docker config

## Files most likely involved
- `www/app/pc/stats.js`
- `www/app/pc/bind.js`
- `www/app/ui/appUi.js`
- `www/app/layout/dialpadSection.js`
- `www/styles/*`

## Exact next safe step
1. Hard refresh the web app.
2. Place any call.
3. Confirm the in-call UI shows live RX/TX packet indicators and they update during the call.

## Verification rule
For this UI change, verify on:
- one outbound call
- one inbound call