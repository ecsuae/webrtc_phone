# Logs: Files

## Source files (web)

- `www/app/features/callMediaLog.js`
  - client-side queueing/sending of call/media diagnostic events
- `www/app/pc/stats.js`
  - WebRTC stats snapshots + render proofs
- `www/app/outgoing/call.js`
  - outbound call lifecycle emits key media/log events
- `www/app/outgoing/ringback.js`
  - outbound local ringback generator + ringback diagnostics

## Source files (server)

- `push-server/src/services/callLogStore.js`
  - ingest sanitization/whitelist for RAW log payload retention
- `push-server/src/admin/callLogPage.js`
  - /admin/calllogs rendering + summary transforms + raw view
