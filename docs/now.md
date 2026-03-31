# NOW

## Current task
TASK-022 — Registration cleanup pass: continue safe dead-code cleanup after registration isolation Steps 1–6, thin Android bridge cleanup, and verified desktop/Android registration success.

## Why this matters
Registration/login was previously getting broken by unrelated work. Registration logic is now being isolated step by step so login/Enable Calls remains independent, testable, and safe to change without affecting call/media logic.

## Already proven
- Desktop registration works.
- Android registration works.
- DNS resolution issue on server side was one real cause of earlier registration failure and has been fixed.
- Registration isolation Steps 1–6 were applied without breaking normal registration:
  - Step 1: registration-owned state
  - Step 2: registration config builder
  - Step 3: registration service/starter
  - Step 4: Enable/Disable Calls actions
  - Step 5: registration event bridge
  - Step 6: registration UI bindings
- Thin Android registration bridge cleanup was applied and Android registration still works.
- One dead old registration path was safely removed:
  - `registerWithSBC(...)` removed
  - `stopSecondaryRegistration(...)` kept because it is still used on logout

## Current blocker
Registration isolation is working, but `docs/now.md` fell behind actual progress and no longer matches the real verified state. Next work must continue from the current verified registration baseline, not from older pending-test text.

## Required focus
- Continue registration cleanup only.
- Remove only registration code that is proven unused.
- Keep behavior unchanged.
- Keep registration independent from:
  - outgoing call logic
  - incoming call logic
  - LTE/Wi-Fi media logic
  - export/PDF/admin call log work

## Do not touch
- media/RTP/TURN/Kamailio call handling
- outgoing/incoming call logic
- export/PDF work
- pinned `?v=` imports
- broad refactors outside registration scope
- Wi-Fi to Wi-Fi working call behavior

## Files most likely involved
- `www/app/registration/state.js`
- `www/app/registration/registrationState.js`
- `www/app/registration/registrationConfig.js`
- `www/app/registration/registrationService.js`
- `www/app/registration/registrationActions.js`
- `www/app/registration/registrationEvents.js`
- `www/app/registration/registrationUiBindings.js`
- `www/app/registration/secondary.js`
- `www/app/runtime/registerFlow.js`
- `www/app/runtime/android/registrationAndroid.js`
- `www/app/runtime/controlBindings.js`
- `www/app/sipRegister.js`
- `www/app/registration/primary.js`

## Exact next safe step
Do a focused registration dead-code audit and remove only code that is proven unused after the new ownership split.

Priority order:
1. identify any remaining old registration wrappers or duplicate execution paths
2. grep-prove whether they are still referenced
3. remove only confirmed dead registration code
4. verify again on:
   - desktop
   - Android

## Verification rule
After every registration cleanup step, verify:
- Enable Calls works on desktop
- Enable Calls works on Android
- Stop / Log off still works
- no background auto-registration happens without explicit enable