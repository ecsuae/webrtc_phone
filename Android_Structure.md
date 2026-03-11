# Android Runtime Structure (Phase 2 Refactor)

## Purpose
This document captures the **Android runtime modularization** introduced in Phase 2, following the same approach as the Desktop Phase 1 refactor.

---

## Entry-point flow (current)

```
www/index.html
  -> /app/page/bootstrapPage.js?v=1773032001
    -> dynamic import /app/main.js?v=1773032001
      -> platform router (Android / iOS / Desktop)
         in /app/main.js?v=1773032001
         -> bootstrapAndroidApp(window.SIP)
            from /app/runtime/android/bootstrapAndroid.js?v=1773032001
```

---

## New Android modules added

- `www/app/runtime/android/bootstrapAndroid.js`
- `www/app/runtime/android/registrationAndroid.js`
- `www/app/runtime/android/callFlowAndroid.js`
- `www/app/runtime/android/pushAndroid.js`
- `www/app/runtime/android/callControlsAndroid.js`

---

## Android module responsibilities

## 1) `bootstrapAndroid.js`
Orchestrates Android app boot:

- Initializes logs and UI
- Creates and shares runtime state (`st`)
- Builds Android registration controller
- Wires:
  - call flow
  - call controls
  - mobile recovery
  - SW wake handling
  - remote logging

**Invariant:** a **single shared app state** (`st`) is created once and passed everywhere.

---

## 2) `registrationAndroid.js`
Android registration wrapper:

- uses **shared state instance** passed from bootstrap (`st`)
- builds one-tap register flow (`runOneTapEnableFlow`)
- exposes `start()` and `stop()`
- manages wake lock helpers
- owns Android-only behavior:
  - **aggressive periodic re-registration** (60s) for background persistence

### Android-only periodic re-registration
Android periodic re-registration was moved out of:

- `www/app/registration/primary.js`

and is now started by the Android runtime wrapper after successful registration.

Wrapper safety defaults are preserved:

- `startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui)`
- `stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg)`

---

## 3) `callFlowAndroid.js`
Android UI event wiring for registration/call actions.

- Delegates to `bindControlHandlers()` in `runtime/controlBindings.js`

---

## 4) `callControlsAndroid.js`
Android call controls shim.

This module is an intentional **no-op**:

- control/tab wiring is initialized once via `bindControlHandlers()` in `runtime/controlBindings.js`

---

## 5) `pushAndroid.js`
Android push setup split from orchestration.

- `Push.init()`
- install shortcut wiring (`setupInstallShortcut`)

---

## Related existing modules in flow

- `www/app/sipRegister.js`
  - `createAppState()`
  - `startAndRegister()`
  - `stopAndUnregister()`

- `www/app/registration/primary.js`
  - authoritative SIP UserAgent/Registerer lifecycle
  - sets `st.registered = true` in accept/state-change path

- `www/app/runtime/mobileRecovery.js`
  - visibility/focus/pageshow/network based recovery (shared)

- `www/app/runtime/swWakeHandler.js`
  - SW message wakeup handling (shared)

- `www/app/ui/callControlAudioRoute.js`
  - contains Android-specific audio route behavior behind UA detection

---

## Android runtime map

```
bootstrapAndroidApp(SIP)
  ├─ createAppState() -> st
  ├─ createUi(st)
  ├─ createAndroidRegistration({ SIP, st, ui, ... })
  │   ├─ createRegisterFlow(...)
  │   └─ startPeriodicReregistration(...) // Android-only
  ├─ setupAndroidPush(...)
  ├─ setupAndroidCallFlow(...)
  ├─ setupAndroidCallControls()  // no-op
  ├─ setupMobileRecovery(...)
  ├─ setupServiceWorkerWakeHandler(...)
  └─ startRemoteLogging()
```

---

## Android file tree (Phase 2 runtime modules)

```text
www/
└── app/
    └── runtime/
        └── android/
            ├── bootstrapAndroid.js
            ├── registrationAndroid.js
            ├── callFlowAndroid.js
            ├── callControlsAndroid.js
            └── pushAndroid.js
```

## Android linked file map

```text
www/index.html
  -> www/app/page/bootstrapPage.js
     -> dynamic import www/app/main.js
        -> www/app/runtime/android/bootstrapAndroid.js
           -> www/app/runtime/android/registrationAndroid.js
              -> www/app/runtime/registerFlow.js
              -> www/app/runtime/wakeLockManager.js
              -> www/app/sipRegister.js
                 -> www/app/registration/primary.js
           -> www/app/runtime/android/callFlowAndroid.js
              -> www/app/runtime/controlBindings.js
                 -> www/app/ui/tabNavigation.js
                 -> www/app/ui/callControls.js
                 -> www/app/ui/callControlAudioRoute.js
           -> www/app/runtime/android/pushAndroid.js
           -> www/app/runtime/mobileRecovery.js
           -> www/app/runtime/swWakeHandler.js
```
