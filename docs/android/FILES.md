# Android: Files

## Android-only source files

- `www/app/runtime/android/audioPlaybackAndroid.js`
  - Android-only playback/routing helpers
  - Owns Android ringback playback implementation
  - Owns Android remote-audio element route enforcement behavior

## Shared files that delegate to Android-only modules

- `www/app/ui/callControlAudioRoute.js`
  - Shared UI + route-mode state
  - Delegates Android enforcement to `runtime/android/audioPlaybackAndroid.js` via dynamic import

- `www/app/outgoing/ringback.js`
  - Shared ringback control + diagnostics
  - Delegates Android ringback playback to `runtime/android/audioPlaybackAndroid.js` via dynamic import
