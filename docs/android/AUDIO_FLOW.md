# Android Audio Flow

## Route mode state

- Route mode is stored in:
  - in-memory `state.mode` in `www/app/ui/callControlAudioRoute.js`
  - `localStorage.audioRouteMode`

## Outbound ringback

- SIP provisional response handling lives in `www/app/outgoing/call.js`.
- If local ringback is started, `www/app/outgoing/ringback.js` delegates Android playback to:
  - `www/app/runtime/android/audioPlaybackAndroid.js` (`startAndroidRingback` / `stopAndroidRingback`)

Android ringback playback implementation:
- Uses an `HTMLAudioElement` playing `/ringing_old_phone.mp3`.
- Prefers reusing `#remoteAudio` only if it is idle (no `srcObject` / no existing `src`).

## Remote party audio after answer

- Remote audio is attached to `#remoteAudio` via:
  - `www/app/outgoing/media.js` (outbound)
  - `www/app/incoming/media.js` (inbound)

- Route enforcement on Android is delegated via:
  - `www/app/ui/callControlAudioRoute.js` -> dynamic import -> `runtime/android/audioPlaybackAndroid.js` (`applyAndroidAudioRoute`).
