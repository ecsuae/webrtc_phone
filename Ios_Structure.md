# iOS Runtime Structure (Phase 2 Refactor)

## Purpose
This document captures the **iOS runtime modularization** introduced in Phase 2, following the same approach as the Desktop Phase 1 refactor.

---

## Entry-point flow (current)

```
www/index.html
  -> /app/page/bootstrapPage.js?v=1773032001
    -> dynamic import /app/main.js?v=1773032001
      -> platform router (Android / iOS / Desktop)
         in /app/main.js?v=1773032001
         -> bootstrapIosApp(window.SIP)
            from /app/runtime/ios/bootstrapIos.js?v=1773032001
```

---

## New iOS modules added

- `www/app/runtime/ios/bootstrapIos.js`
- `www/app/runtime/ios/registrationIos.js`
- `www/app/runtime/ios/callFlowIos.js`
- `www/app/runtime/ios/pushIos.js`
- `www/app/runtime/ios/callControlsIos.js`

---

## iOS module responsibilities

## 1) `bootstrapIos.js`
Orchestrates iOS app boot:

- Initializes logs and UI
- Creates and shares runtime state (`st`)
- Builds iOS registration controller
- Wires:
  - call flow
  - call controls
  - mobile recovery
  - SW wake handling
  - remote logging

**Invariant:** a **single shared app state** (`st`) is created once and passed everywhere.

---

## 2) `registrationIos.js`
iOS registration wrapper:

- uses **shared state instance** passed from bootstrap (`st`)
- builds one-tap register flow (`runOneTapEnableFlow`)
- exposes `start()` and `stop()`
- manages wake lock helpers

Wrapper safety defaults are preserved:

- `startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui)`
- `stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg)`

---

## 3) `callFlowIos.js`
iOS UI event wiring for registration/call actions.

- Delegates to `bindControlHandlers()` in `runtime/controlBindings.js`
- Adds iOS-only behavior:
  - `bindIosAudioUnlock()` to prime ringtone/audio on first user interaction

---

## 4) `callControlsIos.js`
iOS call controls shim.

This module is an intentional **no-op**:

- control/tab wiring is initialized once via `bindControlHandlers()` in `runtime/controlBindings.js`

---

## 5) `pushIos.js`
iOS push / install UX wiring.

- `Push.init()`
- delayed `checkIOSInstallation()` banner handling
- install shortcut wiring (`setupInstallShortcut`)
- iOS load-time push init to keep previous iOS-specific behavior in iOS runtime

---

## Related existing modules in flow

- `www/app/sipRegister.js`
  - `createAppState()`
  - `startAndRegister()`
  - `stopAndUnregister()`

- `www/app/registration/primary.js`
  - authoritative SIP UserAgent/Registerer lifecycle
  - sets `st.registered = true` in accept/state-change path

- `www/app/ui/iosInstallPrompt.js`
  - install + notification permission banners

- `www/app/runtime/mobileRecovery.js`
  - visibility/focus/pageshow/network based recovery (shared)

- `www/app/runtime/swWakeHandler.js`
  - SW message wakeup handling (shared)

---

## iOS runtime map

```
bootstrapIosApp(SIP)
  ├─ createAppState() -> st
  ├─ createUi(st)
  ├─ createIosRegistration({ SIP, st, ui, ... })
  │   ├─ createRegisterFlow(...)
  │   └─ createWakeLockManager(...)
  ├─ setupIosPush(...)
  ├─ setupIosCallFlow(...)
  │   └─ bindIosAudioUnlock()
  ├─ setupIosCallControls()  // no-op
  ├─ setupMobileRecovery(...)
  ├─ setupServiceWorkerWakeHandler(...)
  └─ startRemoteLogging()
```

---

## iOS file tree (Phase 2 runtime modules)

```text
www/
└── app/
    └── runtime/
        └── ios/
            ├── bootstrapIos.js
            ├── registrationIos.js
            ├── callFlowIos.js
            ├── callControlsIos.js
            └── pushIos.js
```

## iOS linked file map

```text
www/index.html
  -> www/app/page/bootstrapPage.js
     -> dynamic import www/app/main.js
        -> www/app/runtime/ios/bootstrapIos.js
           -> www/app/runtime/ios/registrationIos.js
              -> www/app/runtime/registerFlow.js
              -> www/app/runtime/wakeLockManager.js
              -> www/app/sipRegister.js
                 -> www/app/registration/primary.js
           -> www/app/runtime/ios/callFlowIos.js
              -> www/app/runtime/controlBindings.js
                 -> www/app/ui/tabNavigation.js
                 -> www/app/ui/callControls.js
           -> www/app/runtime/ios/pushIos.js
              -> www/app/ui/iosInstallPrompt.js
           -> www/app/runtime/mobileRecovery.js
           -> www/app/runtime/swWakeHandler.js
```
