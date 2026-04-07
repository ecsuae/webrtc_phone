# Desktop: Files

Desktop uses the shared call/media implementation.

## Shared source files

- `www/app/outgoing/call.js`
- `www/app/outgoing/ringback.js` (non-Android WebAudio path)
- `www/app/outgoing/media.js`
- `www/app/incoming/media.js`
- `www/app/ui/callControlAudioRoute.js` (non-Android `setSinkId` path)

## Desktop server/admin viewing

- `push-server/src/admin/callLogPage.js`
- `push-server/src/services/callLogStore.js`
