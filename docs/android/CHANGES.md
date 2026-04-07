# Android: Changes

## Audio playback/routing isolation

- Introduced `www/app/runtime/android/audioPlaybackAndroid.js` as the single Android-owned layer for:
  - applying route-mode behavior to the remote audio element
  - Android ringback playback implementation

- Updated shared modules to delegate Android behavior via dynamic import:
  - `www/app/ui/callControlAudioRoute.js`
  - `www/app/outgoing/ringback.js`

Notes:
- No SIP/SDP/ICE changes.
- Desktop behavior should be unchanged.
