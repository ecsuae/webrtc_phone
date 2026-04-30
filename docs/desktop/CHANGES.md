# Desktop: Changes

- No intended desktop behavior changes in the Android isolation work.

If desktop behavior changes are observed, treat as a regression and inspect the shared delegation points:
- `www/app/outgoing/ringback.js` (Android-only branch)
- `www/app/ui/callControlAudioRoute.js` (Android-only branch)
