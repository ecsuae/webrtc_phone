# now.md

# NOW

## Current task
TASK-022 — Slow/stuck Android registration: Kamailio receives REGISTER + PBX sends 401, but 401 is not relayed promptly over WebSocket.

## Why this matters
Android login appears stuck for a long time because the SIP REGISTER challenge/OK responses are delayed or not delivered back to the browser over WebSocket.

## Already proven
- Android sends REGISTER correctly.
- Kamailio receives REGISTER over WS.
- PBX sends back 401 challenge.
- Kamailio logs show 401 received but relay upstream to WS client fails/delays (client does not see 401/200 promptly).

## Current blocker
WebSocket/TCP stability/timeout behavior in Kamailio may be closing/invalidating the WS connection before the delayed PBX reply can be relayed, causing slow/stuck registration.

## Required focus
- Kamailio WS/TCP timeout and reply relay behavior for REGISTER.
- Smallest safe Kamailio config change that makes 401/200 relay promptly.

## Do not touch
- export/PDF work
- media fixes
- reintroducing pinned `?v=` imports
- unrelated refactors

## Files most likely involved
- `kamailio/kamailio.cfg`
- `kamailio/routes/20-registration.cfg`
- `kamailio/routes/40-replies.cfg`

## Exact next safe step
Restart Kamailio to load WS timeout changes, then place a fresh Android registration attempt and confirm:
- browser receives 401 challenge quickly and completes registration
- Kamailio logs do not show REG-RELAY-FAILED for the REGISTER Call-ID