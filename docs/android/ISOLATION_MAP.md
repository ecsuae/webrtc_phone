# Android Isolation Map

## Android-only modules

- `www/app/runtime/android/audioPlaybackAndroid.js`
  - Android-only playback/routing implementation
  - Android ringback playback (`startAndroidRingback` / `stopAndroidRingback`)
  - Android remote audio enforcement (`applyAndroidAudioRoute`)

- `www/app/runtime/android/registrationAndroid.js`
  - Android-only registration wrapper (guards + rereg timer)

## Shared modules (allowed to contain thin Android delegation)

- `www/app/outgoing/ringback.js`
  - Shared ringback control + diagnostics
  - Android branch delegates to `runtime/android/audioPlaybackAndroid.js`

- `www/app/ui/callControlAudioRoute.js`
  - Shared UI state (`state.mode`) and persistence (`localStorage.audioRouteMode`)
  - Android branch delegates to `runtime/android/audioPlaybackAndroid.js`

- `www/app/outgoing/call.js`
  - Shared outbound call flow
  - Android-only behavior is restricted to minimal checks/branches (e.g., whether to start local ringback)

## Shared modules that must remain platform-neutral

- `www/app/outgoing/media.js` / `www/app/incoming/media.js`
  - Attach remote audio tracks to `#remoteAudio`
  - Call `enforceCurrentAudioRoute()` (which is the delegation boundary)

## Known gaps

- True earpiece/speaker routing on Android WebView typically requires a native bridge (AudioManager communication mode).
  If added, the JS-facing surface should live in:
  - `www/app/runtime/android/audioPlaybackAndroid.js`
