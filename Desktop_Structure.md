# Desktop Runtime Structure (Phase 1 Refactor)

## Purpose
This document captures the **desktop runtime modularization** introduced in Phase 1 and the follow-up fixes made while debugging the “registered in SIP logs but still on login screen” issue.

---

## What Changed

### Entry-point flow (current)

```
www/index.html
  -> /app/page/bootstrapPage.js?v=1773032001
    -> dynamic import /app/main.js?v=1773032001
      -> bootstrapDesktopApp(window.SIP)
         from /app/runtime/desktop/bootstrapDesktop.js?v=1773032001
```

### New desktop modules added

- `www/app/runtime/desktop/bootstrapDesktop.js`
- `www/app/runtime/desktop/registrationDesktop.js`
- `www/app/runtime/desktop/callFlowDesktop.js`
- `www/app/runtime/desktop/pushDesktop.js`
- `www/app/runtime/desktop/callControlsDesktop.js`

---

## Desktop module responsibilities

## 1) `bootstrapDesktop.js`
Orchestrates desktop app boot:

- Initializes logs and UI
- Creates and shares runtime state (`st`)
- Builds registration controller
- Wires:
  - call flow
  - call controls
  - mobile recovery
  - SW wake handling
  - remote logging

### Critical fix applied
A **single shared app state** is now used everywhere:

- `const st = createAppState();`
- `const ui = createUi(st);`
- same `st` passed into call flow, controls, recovery, SW wake handler, and returned from bootstrap

This prevents UI-state mismatch where SIP could register on one state object while UI read another.

---

## 2) `registrationDesktop.js`
Desktop registration wrapper:

- uses **shared state instance** passed from bootstrap (`st`)
- builds one-tap register flow (`runOneTapEnableFlow`)
- exposes `start()` and `stop()`
- manages wake lock helpers

### Regression fix applied
This module no longer creates its own app state.  
Previous split-state behavior caused SIP registration status and UI visibility to drift.

Current signature:
- `createDesktopRegistration({ SIP, st, ui, logLine, nowISO })`

Wrapper safety defaults are still preserved:
- `startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui)`
- `stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg)`

---

## 3) `callFlowDesktop.js`
Desktop UI event wiring for registration/call actions:

- Start (register)
- Stop (unregister)
- Call / Hangup
- related status and history hooks

Receives shared runtime dependencies from `bootstrapDesktop.js`.

---

## 4) `callControlsDesktop.js`
Desktop call controls shim for Phase 1 refactor.

### Regression fix applied
This module is now an intentional **no-op**:
- control/tab wiring is already initialized once via `bindControlHandlers()` in `runtime/controlBindings.js`
- duplicate initialization here caused potential UI desync side effects

---

## 5) `pushDesktop.js`
Desktop push setup split from main orchestration.

- SW/push-related initialization wiring
- keeps previous push behavior intact

---

## Related existing modules in flow

- `www/app/sipRegister.js`
  - `createAppState()`
  - `startAndRegister()`
  - `stopAndUnregister()`

- `www/app/registration/primary.js`
  - actual SIP UserAgent/Registerer lifecycle
  - sets `st.registered = true` in accept/state-change path

- `www/app/ui/appUi.js`
  - login/dialpad visibility uses `st.registered` (`updateControlVisibility` path)

---

## Cache-busting updates made (to avoid stale module graph)

- `www/index.html`
  - `/app/page/bootstrapPage.js?v=1773032001`
- `www/app/page/bootstrapPage.js`
  - imports bumped to `v=1773032001`
  - dynamic import `../main.js?v=1773032001`
- `www/app/main.js`
  - imports `./runtime/desktop/bootstrapDesktop.js?v=1773032001`

---

## Why this structure matters for the bug

Your logs show successful registration:

- REGISTER challenged (401) then authenticated
- REGISTER accepted (200)
- SIP registerer transitions to `Registered`

If UI still stays on login screen, root cause is usually:

1. stale cached JS (old graph still loaded), or
2. state object mismatch between registration and UI

This refactor/fix set addresses both by:
- enforcing shared state wiring in desktop bootstrap
- bumping module versions to force fresh load

---

## Current desktop runtime map

```
bootstrapDesktopApp(SIP)
  ├─ createAppState() -> st
  ├─ createUi(st)
  ├─ createDesktopRegistration({ SIP, st, ui, ... }) -> registration controller (shared st)
  ├─ setupDesktopPush(...)
  ├─ setupDesktopCallFlow({ st, ui, SIP, ... })
  ├─ setupDesktopCallControls()  // no-op (avoid duplicate binding)
  ├─ setupMobileRecovery({ st, ui, SIP, startAndRegister, ... })
  ├─ setupServiceWorkerWakeHandler({ st, ui, SIP, startAndRegister, ... })
  └─ startRemoteLogging()
```

---

## Files modified in this debugging round

- `www/app/runtime/desktop/bootstrapDesktop.js`
- `www/app/runtime/desktop/registrationDesktop.js`
- `www/app/runtime/desktop/callControlsDesktop.js`
- `www/app/main.js`
- `www/app/page/bootstrapPage.js`
- `www/index.html`

---

## Desktop file tree (Phase 1 runtime modules)

```text
www/
└── app/
    └── runtime/
        └── desktop/
            ├── bootstrapDesktop.js
            ├── registrationDesktop.js
            ├── callFlowDesktop.js
            ├── callControlsDesktop.js
            └── pushDesktop.js
```

## Notes
This document is focused on **desktop runtime structure and related fixes only**.  
For full project-wide architecture, refer to `Structure.md`.
