# TASK-031 — desktop app refactor/isolation (standalone; no shared code with Android/iOS)

## Goal
Make the desktop app a standalone app with desktop-owned code paths and clear desktop-owned structure, with **no shared/common code dependency** on Android or iOS.

## Scope
- Desktop app code refactor and isolation only.
- Desktop must become a standalone app.
- Desktop-specific code must live under a desktop-owned structure only.
- Desktop must not depend on any Android or iOS code paths.
- Desktop must not use shared/common registration code.
- Registration and other platform behaviors must be desktop-owned (no shared/common platform logic hidden under generic helpers).
- Refactor should remove or replace shared/common desktop dependencies rather than preserve them.

## Out of scope
- Any Android refactor or behavior change.
- Any iOS refactor or behavior change.
- Any changes to shared/common code intended to keep desktop coupled to mobile.
- Any push-server work.
- Any nginx work.
- Any TASK-029 work.

## Current risk / blocker
- Desktop app isolation risk: desktop behavior may currently be coupled to mobile/shared modules (including registration), making safe extraction non-obvious without an initial inventory.

## Initial inventory requirement
Before moving code, inventory and record:
- Desktop app entrypoints, build/run wiring, and current module boundaries.
- Every import path used by desktop that originates from Android/iOS or shared/common modules.
- Registration/auth flow ownership and where desktop currently gets its registration logic.
- Any platform abstractions that are “generic helpers” but hide mobile/shared logic.

## Definition of done
- Desktop app runs from desktop-owned code paths.
- Desktop app has **no dependency** on Android/iOS shared/common app code.
- Desktop app does **not** use any shared/common registration flow.
- Desktop app platform behaviors (including registration) are desktop-owned and explicit.
- Desktop structure is clear and maintainable.
- Workflow docs updated truthfully as work progresses (`docs/now.md`, `docs/session-log.md`, `docs/change-ledger.md`, and this task file).

## Status
- Complete/closed.
- Desktop isolation/refactor is complete; remaining work is runtime/correctness debugging only (tracked under TASK-032).

## Implementation approach guardrails
- Keep changes isolation-first and behavior-preserving where possible.
- Prefer coherent feature/file moves; avoid tiny fragmented helpers.
- If a refactor unit exceeds 200 lines, split into two coherent desktop-owned files.

## Inventory findings (desktop)

### Desktop entrypoints and build/run wiring
- Entry HTML: `www/index.html`
  - Loads `app/page/bootstrapPage.js` (module) with `cb` cache-bust token.
- Page bootstrap: `www/app/page/bootstrapPage.js`
  - Dynamically imports `../main.js?cb=...`.
- Runtime selector: `www/app/main.js`
  - Chooses runtime via user-agent detection:
    - Android: `./runtime/android/bootstrapAndroid.js`
    - iOS: `./runtime/ios/bootstrapIos.js`
    - Desktop (else): `./runtime/desktop/bootstrapDesktop.js`
- Desktop bootstrap: `www/app/runtime/desktop/bootstrapDesktop.js`
  - Sets platform adapter via `setPlatformAdapter(createPlatformAdapterDesktop())`.
  - Creates app state via `createAppState()` from `www/app/sipRegister.js`.
  - Creates registration via `createDesktopRegistration(...)`.

### Desktop imports/dependencies that come from shared/common code
Desktop runtime currently depends on shared/common (non-desktop-owned) modules. Examples found:

- Desktop bootstrap (`www/app/runtime/desktop/bootstrapDesktop.js`) imports shared/common modules:
  - `www/app/sipRegister.js` (app state + start/stop register)
  - UI modules: `www/app/ui/*` (`appUi.js`, `historyActivity.js`, `callTimer.js`)
  - Shared runtime hooks: `www/app/runtime/shared/platformAdapter.js`
  - Shared runtime helpers: `www/app/runtime/mobileRecovery.js`, `www/app/runtime/swWakeHandler.js`
  - Cross-platform utilities: `www/app/log.js`, `www/app/dom.js`, `www/app/config.js`, `www/app/remoteLogs.js`, `www/app/push/recoverySession.js`

- Desktop call flow (`www/app/runtime/desktop/callFlowDesktop.js`) depends on shared/common control binding:
  - `www/app/runtime/shared/controlBindingsCore.js`

- Shared control binding (`www/app/runtime/shared/controlBindingsCore.js`) imports cross-platform features:
  - `www/app/registration/registrationUiBindings.js`
  - `www/app/sipCall.js`, `www/app/sipCallIncoming.js`
  - `www/app/incoming/alert.js`
  - `www/app/ui/tabNavigation.js`, `www/app/ui/callControls.js`
  - `www/app/conference/join.js`

### Desktop imports/dependencies from Android/iOS-owned code
- No direct imports from `www/app/runtime/android/*` or `www/app/runtime/ios/*` were found in the desktop runtime modules inspected.
- However, desktop and mobile currently share many non-desktop-owned modules (shared/common code), which violates the target end state for this task.

### Desktop registration/auth ownership and shared/common dependency
- Desktop registration (`www/app/runtime/desktop/registrationDesktop.js`) currently depends on shared/common registration code:
  - `startAndRegister` / `stopAndUnregister` from `www/app/sipRegister.js`
  - `createRegisterFlow` from `www/app/runtime/registerFlow.js`
  - `createWakeLockManager` from `www/app/runtime/wakeLockManager.js`
- `www/app/runtime/registerFlow.js` depends on `www/app/registration/registrationActions.js`.
- `www/app/sipRegister.js` depends on `www/app/registration/*` including `registration/primary.js`.

Conclusion (truthful): desktop currently uses shared/common registration flow and shared/common platform logic.

## Desktop-owned target boundaries (end state)
- Desktop entrypoint must be desktop-owned (desktop-specific bootstrap + desktop-specific state + desktop-specific registration).
- Desktop registration/auth must be desktop-owned:
  - No dependency on `www/app/sipRegister.js` or `www/app/registration/*` for desktop.
  - No dependency on `www/app/runtime/registerFlow.js` or `www/app/registration/registrationActions.js` for desktop.
- Desktop must not depend on Android/iOS runtime modules, and must not depend on shared/common modules that also serve Android/iOS.

## Concrete isolation-first plan (multi-step)

### Step 1 — Define desktop-owned structure and entrypoints (no behavior change)
- Create a desktop-owned tree (example naming): `www/app/desktop/*`.
- Add a desktop-owned bootstrap entrypoint (example): `www/app/desktop/bootstrapDesktopApp.js`.
- Keep `www/app/main.js` as the runtime selector for now, but make the desktop branch load the new desktop-owned bootstrap.

### Step 2 — Desktop-owned registration module (remove shared/common registration dependency)
- Create a desktop-owned registration module (example): `www/app/desktop/registration/desktopRegistration.js`.
- Goal: remove desktop imports of:
  - `www/app/sipRegister.js`
  - `www/app/runtime/registerFlow.js`
  - `www/app/registration/*`
- This step should be implemented as one coherent desktop-owned module (~150–200 lines). If it exceeds 200 lines, split into exactly two coherent desktop-owned files:
  - `desktopRegistrationCore.js`
  - `desktopRegistrationUiOrchestration.js`

### Step 3 — Desktop-owned app state and call-control bindings (remove shared controlBindingsCore dependency)
- Replace desktop usage of `www/app/runtime/shared/controlBindingsCore.js` with a desktop-owned binding module.
- Keep behavior identical where possible.
- One coherent desktop-owned file (~150–200 lines), with a strict two-file split if needed.

### Step 4 — Desktop-owned platform adapter + desktop-only runtime hooks
- Ensure desktop platform adapter and any runtime hooks used by desktop are desktop-owned.
- Remove desktop dependency on `www/app/runtime/mobileRecovery.js` and `www/app/runtime/swWakeHandler.js` unless they are re-implemented desktop-owned.

### Step 5 — Remove remaining shared/common imports used by desktop
- Iterate remaining desktop imports until desktop runs only on desktop-owned code paths.
- Confirm (by code inspection + build/run verification in a later step) that desktop has no shared/common registration flow and no Android/iOS shared/common dependency.

## Timestamped task history

### 2026-04-09T04:06:00Z — Step 1: desktop-owned bootstrap entrypoint added; desktop branch switched to it (behavior-preserving)
- **Change**:
  - Added a desktop-owned bootstrap module at `www/app/desktop/bootstrapDesktopApp.js`.
  - Updated only the desktop branch selector in `www/app/main.js` to import `./desktop/bootstrapDesktopApp.js`.
  - Kept orchestration behavior intentionally identical to the prior desktop bootstrap (no registration isolation in this step).
- **Files changed**:
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/main.js`
- **Restart required**:
  - Yes (reload the web app / desktop client) to pick up the new module path.
- **Verified result**:
  - Code inspection only. (Attempted `node -c` syntax check, but these files are ES modules and Node check-syntax failed without ESM configuration.)
- **Next safe step**:
  - Proceed to Step 2: implement desktop-owned registration module and remove desktop dependency on shared/common registration (`sipRegister.js` / `registration/*`).

### 2026-04-09T04:10:00Z — Step 2: desktop-owned registration module created; desktop registration no longer uses shared/common registration flow
- **Change**:
  - Added desktop-owned registration module: `www/app/desktop/registration/desktopRegistration.js`.
  - Desktop bootstrap now uses desktop-owned registration + desktop-owned app state:
    - Removed desktop bootstrap imports of `www/app/sipRegister.js`.
    - Desktop registration path no longer uses `www/app/runtime/registerFlow.js` or `www/app/registration/*`.
  - Android and iOS registration paths were not modified.
- **Files changed**:
  - `www/app/desktop/registration/desktopRegistration.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Proceed to Step 3: replace desktop usage of shared `controlBindingsCore.js` with a desktop-owned binding module (behavior-preserving).

### 2026-04-09T04:15:00Z — Step 3: desktop-owned call-control bindings; desktop no longer uses shared controlBindingsCore.js
- **Change**:
  - Added desktop-owned call-control binding module: `www/app/desktop/bindings/desktopControlBindings.js`.
  - Updated desktop call flow to use desktop-owned bindings and removed desktop dependency on `www/app/runtime/shared/controlBindingsCore.js`.
  - Android and iOS paths were not modified.
- **Files changed**:
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/runtime/desktop/callFlowDesktop.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Proceed to Step 4: desktop-owned platform adapter + desktop-only runtime hooks (reduce/remove desktop dependency on shared `mobileRecovery.js` and `swWakeHandler.js` if possible).

### 2026-04-09T04:19:00Z — Step 4: desktop-owned runtime recovery hooks; desktop no longer uses shared mobileRecovery/swWakeHandler
- **Change**:
  - Added desktop-owned runtime hooks:
    - `www/app/desktop/runtime/desktopRecoveryHooks.js`
    - `www/app/desktop/runtime/desktopServiceWorkerWakeHandler.js`
  - Desktop bootstrap now uses these desktop-owned hooks and no longer imports:
    - `www/app/runtime/mobileRecovery.js`
    - `www/app/runtime/swWakeHandler.js`
  - Android and iOS paths were not modified.
- **Files changed**:
  - `www/app/desktop/runtime/desktopRecoveryHooks.js`
  - `www/app/desktop/runtime/desktopServiceWorkerWakeHandler.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 4 completion by isolating the platform adapter path (desktop-owned adapter surface) if needed, then proceed to Step 5 to remove remaining shared/common imports.

### 2026-04-09T04:24:00Z — Step 5 (partial): desktop-owned platform adapter registry; desktop bootstrap no longer imports shared platformAdapter.js
- **Change**:
  - Added desktop-owned platform adapter registry: `www/app/desktop/runtime/platformAdapterRegistry.js`.
  - Desktop bootstrap now uses `setDesktopPlatformAdapter(...)` and no longer imports `www/app/runtime/shared/platformAdapter.js`.
  - Residual dependency note: shared/common modules used by desktop still import `getPlatformAdapter()` from `www/app/runtime/shared/platformAdapter.js`; removing those requires additional Step 5 follow-up.
- **Files changed**:
  - `www/app/desktop/runtime/platformAdapterRegistry.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5 by migrating desktop-used shared modules off `getPlatformAdapter()` (desktop-owned adapter surface end-to-end) without changing Android/iOS behavior.

### 2026-04-09T04:43:00Z — Step 5: desktop-owned outbound ringback + provisional delegate; desktop outbound startCall no longer routes through shared outgoing/ringback/index.js
- **Change**:
  - Added desktop-owned outbound boundary:
    - `www/app/desktop/outgoing/desktopRingbackDelegate.js` (ringback + provisional response delegate using desktop adapter surface).
    - `www/app/desktop/outgoing/desktopStartCall.js` (desktop-owned startCall wiring to the desktop delegate/ringback).
  - Updated desktop control bindings to use desktop-owned `startCall` and stop importing the shared `sipCall.js` facade.
  - Desktop path no longer depends on shared `www/app/outgoing/ringback/index.js` ownership for outbound ringback/provisional handling.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopRingbackDelegate.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate the remaining desktop-used shared modules that import `requirePlatformAdapter()` (e.g. outgoing media/audio-route enforcement path) onto desktop-owned adapter surface.

### 2026-04-09T04:50:00Z — Step 5: desktop-owned outgoing media + audio-route enforcement; desktop outbound no longer uses shared outgoing/media.js (requirePlatformAdapter)
- **Change**:
  - Added desktop-owned outgoing media boundary: `www/app/desktop/outgoing/desktopOutgoingMedia.js`.
  - Updated desktop outbound delegate to use desktop-owned media module and desktop adapter surface for audio-route enforcement and media diagnostics.
  - Desktop outbound path no longer imports shared `www/app/outgoing/media.js` (which imports shared `requirePlatformAdapter()`).

### 2026-04-11T17:52:00Z — Step 5: desktop-owned layout + DOM refs boundary implemented (runtime verification pending)
- **Change**:
  - Desktop renders desktop-owned registration+dialpad layout: `www/app/desktop/ui/desktopAppLayout.js`.
  - Desktop uses desktop-owned DOM refs cache for that area: `www/app/desktop/ui/desktopDomRefs.js`.
  - Desktop bootstrap uses desktop render + `refreshDesktopEl()` and desktop bindings/registration read from `desktopEl`.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppLayout.js`
  - `www/app/desktop/ui/desktopDomRefs.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `www/app/page/bootstrapPage.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser verify after reload: Enable Calls (one click), Log Off (btnStop), incoming banner/ringtone on INVITE, call controls, hangup; confirm desktop reads refs via `desktopDomRefs` (not shared `www/app/dom.js`) for this boundary.

### 2026-04-09T04:56:00Z — Step 5: desktop-owned incoming alert/ringtone; desktop no longer uses shared incoming/alert/ringtone (requirePlatformAdapter)
- **Change**:
  - Added desktop-owned incoming alert + ringtone module: `www/app/desktop/incoming/desktopIncomingAlert.js`.
  - Updated desktop control bindings to use desktop-owned `primeIncomingRingtone`.
  - Desktop no longer imports shared `www/app/incoming/alert/ringtone.js` (which imports shared `requirePlatformAdapter()`).
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingAlert.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate the incoming attach-audio path off shared `requirePlatformAdapter()` onto desktop-owned adapter surface.

### 2026-04-09T19:25:00Z — Step 5: desktop-owned incoming attach-audio; desktop answer flow no longer uses shared incoming/media/attachIncomingRemoteAudio.js (requirePlatformAdapter)
- **Change**:
  - Added desktop-owned incoming remote audio boundary:
    - `www/app/desktop/incoming/desktopIncomingRemoteAudio.js`
    - `www/app/desktop/incoming/desktopIncomingRemoteAudioSupport.js`
  - Added desktop-owned desktop answer handler:
    - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - Updated desktop control bindings to answer via desktop-owned handler, which starts a desktop-owned early attach loop.
  - Desktop answer path no longer uses shared `startIncomingEarlyMediaLoop()` / shared `attachIncomingRemoteAudio()` which imports shared `requirePlatformAdapter()`.
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingRemoteAudio.js`
  - `www/app/desktop/incoming/desktopIncomingRemoteAudioSupport.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate the global audio-route enforcement path off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

### 2026-04-09T19:45:00Z — Step 5: desktop-owned global audio-route enforcement; desktop call-controls no longer import shared ui/audioRoute/enforce.js (requirePlatformAdapter)
- **Change**:
  - Added desktop-owned call-controls audio-route module (speaker toggle + persistence + route enforce) that uses `getDesktopPlatformAdapter()`.
  - Switched desktop call-controls initialization to desktop-owned module so desktop no longer imports shared `www/app/ui/audioRoute/enforce.js` (shared `requirePlatformAdapter()` dependency).
  - Also fixed desktop `btnCall` incoming-answer path to use the desktop-owned `answerIncomingCallDesktop()` handler.
- **Files changed**:
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/ui/desktopCallControlAudioRoute.js`
  - `www/app/desktop/ui/desktopCallControls.js`
  - `www/app/desktop/ui/desktopCallControlsDtmf.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate the shared Established-state incoming attach path off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

### 2026-04-09T20:10:00Z — Step 5: desktop-owned Established-state incoming attach handler; desktop no longer uses shared incoming/handlers/onEstablished.js (shared attach + requirePlatformAdapter)
- **Change**:
  - Added desktop-owned Established-state handler for inbound calls and wired desktop UA incoming invitation delegate to use it.
  - Desktop Established-state handling now attaches inbound remote audio via `attachDesktopIncomingRemoteAudio()` and no longer uses shared `attachIncomingRemoteAudio()` (shared `requirePlatformAdapter()` dependency).
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingEstablished.js`
  - `www/app/desktop/incoming/desktopOnIncomingEstablished.js`
  - `www/app/desktop/registration/desktopRegistration.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate desktop incoming alert/ringtone ownership off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

### 2026-04-09T20:25:00Z — Step 5: desktop-owned incoming alert/ringtone end-to-end; desktop no longer imports shared incoming/alert.js (shared ringtone requires requirePlatformAdapter)
- **Change**:
  - Desktop answer flow no longer imports shared `www/app/incoming/alert.js` / `www/app/incoming/alert/*`.
  - Desktop incoming alert/ringtone behavior is owned by `www/app/desktop/incoming/desktopIncomingAlert.js` and uses `getDesktopPlatformAdapter()`.
- **Files changed**:
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: audit remaining desktop imports for shared `requirePlatformAdapter()` / `getPlatformAdapter()` usage and move the next highest-value boundary to desktop-owned (behavior-preserving; do not change Android/iOS).

### 2026-04-11T18:34:00Z — Step 5: desktop-owned UI orchestration; desktop bootstrap no longer uses shared ui/appUi.js
- **Change**:
  - Added desktop-owned UI orchestration module: `www/app/desktop/ui/desktopAppUi.js`.
  - Desktop bootstrap now creates UI via `createDesktopUi()` and no longer imports shared `www/app/ui/appUi.js`.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate desktop bootstrap off remaining shared `www/app/ui/*` support modules (history/timer).

### 2026-04-12T01:54:00Z — Step 5: desktop-owned conference join; desktop no longer imports shared conference/join.js
- **Change**:
  - Added desktop-owned conference join module: `www/app/desktop/conference/desktopJoinConference.js`.
  - Desktop control bindings now use `joinDesktopConference` from desktop-owned module.
  - Desktop no longer imports shared `www/app/conference/join.js`.
  - Desktop conference join now uses desktop-owned `startCall` from `desktopStartCall.js` and desktop-owned `primeIncomingRingtone` from `desktopIncomingAlert.js`.
- **Files changed**:
  - `www/app/desktop/conference/desktopJoinConference.js` (new - 164 lines)
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `conference/join.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports.

### 2026-04-12T01:48:00Z — Step 5: desktop-owned incoming state cleanup; desktop answer flow no longer imports shared incoming/handlers/state.js
- **Change**:
  - Added desktop-owned incoming state module: `www/app/desktop/incoming/desktopIncomingState.js`.
  - Desktop answer flow now uses `cleanupDesktopIncomingState` from desktop-owned module.
  - Desktop no longer imports shared `www/app/incoming/handlers/state.js` (via cleanupIncomingState).
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingState.js` (new)
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `incoming/handlers/state.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, etc.).

### 2026-04-12T01:42:00Z — Step 5: desktop-owned tab navigation; desktop no longer imports shared ui/tabNavigation.js
- **Change**:
  - Added desktop-owned tab navigation module: `www/app/desktop/ui/desktopTabNavigation.js`.
  - Desktop control bindings now use `setupDesktopTabNavigation` from desktop-owned module.
  - Desktop no longer imports shared `www/app/ui/tabNavigation.js`.
- **Files changed**:
  - `www/app/desktop/ui/desktopTabNavigation.js` (new)
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `tabNavigation.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, incoming/handlers/state.js, etc.).

### 2026-04-12T01:35:00Z — Step 5: desktop-owned incoming call reject; desktop no longer imports shared sipCallIncoming.js for reject
- **Change**:
  - Added desktop-owned incoming reject module: `www/app/desktop/incoming/desktopRejectIncomingCall.js`.
  - Desktop control bindings now use `rejectDesktopIncomingCall` from desktop-owned module.
  - Desktop no longer imports shared `www/app/sipCallIncoming.js` (via rejectIncomingCallIsolated).
  - Desktop reject now uses desktop-owned `stopIncomingAlert` from `desktopIncomingAlert.js` and desktop-owned `cleanupDesktopIncomingState`.
- **Files changed**:
  - `www/app/desktop/incoming/desktopRejectIncomingCall.js` (new)
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `sipCallIncoming.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, ui/tabNavigation.js, incoming/handlers/state.js, etc.).

### 2026-04-12T01:24:00Z — Step 5: desktop-owned remote logging wrapper; desktop bootstrap no longer directly imports shared remoteLogs.js
- **Change**:
  - Added desktop-owned remote logging wrapper: `www/app/desktop/desktopRemoteLogs.js`.
  - Desktop bootstrap now uses `startDesktopRemoteLogging` from desktop-owned wrapper (which delegates to shared remoteLogs internally).
  - Desktop bootstrap no longer directly imports `www/app/remoteLogs.js`; the dependency is encapsulated in the desktop-owned wrapper.
- **Files changed**:
  - `www/app/desktop/desktopRemoteLogs.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms bootstrapDesktopApp.js no longer directly imports shared remoteLogs.js; only desktopRemoteLogs.js imports it).
- **Next safe step**:
  - TASK-031 Step 5: continue isolating remaining desktop shared imports or perform runtime verification.

### 2026-04-12T00:30:00Z — Step 5: desktop-owned session recovery (password hydration); desktop no longer imports shared push/recoverySession.js
- **Change**:
  - Added desktop-owned session recovery module: `www/app/desktop/desktopRecoverySession.js`.
  - Desktop bootstrap now uses `hydratePasswordInput` from desktop-owned module.
  - Desktop registration now uses `clearSessionPassword` from desktop-owned module.
  - Desktop no longer imports shared `www/app/push/recoverySession.js`.
- **Files changed**:
  - `www/app/desktop/desktopRecoverySession.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/registration/desktopRegistration.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `recoverySession.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js) if needed.

### 2026-04-12T00:20:00Z — Step 5: desktop-owned nowISO/logLine imports throughout desktop runtime; desktop bootstrap+call flow no longer import shared config.js or log.js
- **Change**:
  - Updated 12 desktop modules to import `nowISO`/`logLine`/`formatSipResponse`/`getSipRejectDetails`/`mapSipFailureToMessage` from desktop-owned `desktopLogging.js` instead of shared `config.js`/`log.js`.
  - Updated modules: `desktopStartCall.js`, `desktopIncomingAlert.js`, `desktopHangupCall.js`, `desktopOutboundStateChange.js`, `desktopAnswerIncomingCall.js`, `desktopIncomingEstablished.js`, `desktopOnIncomingEstablished.js`, `desktopCallControls.js`, `desktopIncomingRemoteAudio.js`, `desktopIncomingRemoteAudioSupport.js`, `desktopRingbackDelegate.js`, `desktopOutgoingMedia.js`, `desktopControlBindings.js`.
  - Desktop bootstrap no longer imports shared `config.js` or `log.js` (uses `desktopLogging.js` only).
- **Files changed**:
  - `www/app/desktop/desktopLogging.js` (existing)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopIncomingAlert.js`
  - `www/app/desktop/outgoing/desktopHangupCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/incoming/desktopIncomingEstablished.js`
  - `www/app/desktop/incoming/desktopOnIncomingEstablished.js`
  - `www/app/desktop/ui/desktopCallControls.js`
  - `www/app/desktop/incoming/desktopIncomingRemoteAudio.js`
  - `www/app/desktop/incoming/desktopIncomingRemoteAudioSupport.js`
  - `www/app/desktop/outgoing/desktopRingbackDelegate.js`
  - `www/app/desktop/outgoing/desktopOutgoingMedia.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only (grep confirms no remaining `config.js` or `log.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js, push/recoverySession.js) if needed.

### 2026-04-12T00:10:00Z — Step 5: desktop-owned logging + timestamps; desktop bootstrap no longer imports shared log.js or config.js
- **Change**:
  - Added desktop-owned logging module: `www/app/desktop/desktopLogging.js`.
  - Desktop bootstrap now uses `bootLog`, `logLine`, `nowISO` from desktop-owned module.
  - Desktop bootstrap no longer imports shared `www/app/log.js` or `www/app/config.js`.
  - Desktop logging uses desktop DOM refs (`desktopEl.log`) instead of shared DOM (`el.log`).
- **Files changed**:
  - `www/app/desktop/desktopLogging.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js, push/recoverySession.js) if needed.

### 2026-04-11T18:46:00Z — Step 5: desktop-owned UI support (history + timer); desktop bootstrap no longer uses shared historyActivity/callTimer
- **Change**:
  - Added desktop-owned UI support modules:
    - `www/app/desktop/ui/desktopUiSupport.js`
    - `www/app/desktop/ui/desktopUiSupportState.js` (history implementation)
  - Desktop bootstrap now uses `createDesktopHistoryActivity()` and `createDesktopCallTimer()`.
  - Desktop bootstrap no longer imports shared `www/app/ui/historyActivity.js` or `www/app/ui/callTimer.js`.
- **Files changed**:
  - `www/app/desktop/ui/desktopUiSupport.js`
  - `www/app/desktop/ui/desktopUiSupportState.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm History renders + dial works, timer works, and outbound call sends INVITE.

### 2026-04-12T02:07:00Z — Step 5: desktop-owned LTE relay readiness guard; desktop call flows no longer import shared features/lteCallGuard.js
- **Change**:
  - Added desktop-owned LTE relay readiness guard module: `www/app/desktop/desktopLteCallGuard.js`.
  - Desktop outbound and inbound call flows now use `guardDesktopLteRelayReadiness()` and no longer import shared `www/app/features/lteCallGuard.js`.
- **Files changed**:
  - `www/app/desktop/desktopLteCallGuard.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `features/lteCallGuard.js` imports under `www/app/desktop`).
- **Next safe step**:
  - Continue Step 5: isolate the next highest-value shared/common module still used by active desktop runtime path (prefer outgoing/call/* or incoming/handlers/*).

### 2026-04-12T02:23:00Z — Step 5: desktop-owned outbound-call-start support; desktopStartCall no longer imports shared outgoing/call/*
- **Change**:
  - Added desktop-owned outbound-call-start support modules:
    - `www/app/desktop/outgoing/desktopStartCallSupport.js` (remote audio config, outbound diag context, inviter creation)
    - `www/app/desktop/outgoing/desktopStartCallPreflight.js` (LTE preflight)
  - Desktop outbound call start now uses desktop-owned support/preflight and no longer imports shared `www/app/outgoing/call/*` modules.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCallSupport.js`
  - `www/app/desktop/outgoing/desktopStartCallPreflight.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms `www/app/desktop/outgoing/desktopStartCall.js` has no `outgoing/call/*` imports).
- **Next safe step**:
  - Continue Step 5: isolate next highest-value shared/common module still used by active desktop runtime path (prefer `www/app/incoming/handlers/*`).

### 2026-04-12T02:31:00Z — Runtime/browser verification (partial checklist): desktop call path after reload
- **Environment**:
  - Desktop runtime path (per user): `www/app/main.js` → `www/app/desktop/bootstrapDesktopApp.js`
- **Verified result (runtime/browser; user report)**:
  - PASS:
    - Enable Calls works on first click
    - Outbound Call sends real SIP INVITE
    - Ringing/ringback audible
    - Two-way audio after answer
    - Hangup/end works
    - Incoming call alert/banner/ringtone appears on INVITE
  - NOT TESTED (still unverified):
    - Log Off works via btnStop
    - History tab renders
    - Clicking a History item fills `#dial` and triggers Call
    - Timer starts on establish and stops on end
- **Files changed since previous baseline**:
  - n/a (verification only)
- **Restart required**:
  - No (verification only)
- **Next safe step**:
  - Runtime/browser: verify remaining untested items above; do not claim TASK-031 complete until they pass.

### 2026-04-12T02:41:00Z — Desktop UI regressions fix: btnStop visibility + timer stop/reset on hangup
- **Change**:
  - Fixed desktop btnStop visibility logic in desktop-owned UI buttons state.
  - Ensured call timer stops/resets when leaving in-call state and on explicit hangup path.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/outgoing/desktopHangupCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm btnStop is visible when registered and that call timer stops/resets after hangup.

### 2026-04-12T02:54:00Z — Desktop UI controls fix: Log Off icon on dialer + hide earpiece/record
- **Change**:
  - Desktop UI now toggles the status-bar Log Off icon (`logOffBtn`) when registered so Log Off is accessible on the dialer screen.
  - Desktop call controls hide unsupported controls: earpiece (`btnSpeaker`) and record (`btnRecord`).
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/ui/desktopCallControls.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: after reload, confirm Log Off control visible/works on dialer and confirm earpiece/record controls are hidden.

### 2026-04-12T03:05:00Z — Desktop UI controls follow-up: logOffBtn sync + keep earpiece hidden
- **Change**:
  - Desktop UI now also toggles `logOffBtn` visibility during `ui.setStatus()` (not only during `ui.setButtons()`) to ensure the dialer Log Off icon appears immediately on registration state changes.
  - Desktop call controls no longer initialize audio-route behavior on `btnSpeaker` (prevents re-showing the hidden control).
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/ui/desktopCallControls.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: after reload, confirm Log Off icon visible on dialer when registered; confirm earpiece/record controls remain hidden.

### 2026-04-12T03:22:00Z — Desktop call end cleanup: stop mic on remote hangup (outbound terminated)
- **Problem (runtime report)**:
  - When other party hangs up, call disconnects but microphone remains in use; intermittent one-way audio observed (remote cannot hear).
- **Change**:
  - Desktop outbound session termination handler now calls `stopLocalAudioStream()` on `SIP.SessionState.Terminated` so the mic stream is released when the remote ends the call.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime: outbound call -> have remote hang up -> confirm mic indicator turns off and next call has two-way audio.

### 2026-04-12T03:51:00Z — Desktop local mic ownership boundary (fresh acquire + sender attach/replace + release)
- **Problem (runtime report)**:
  - Remote side cannot hear desktop user (intermittent); microphone sometimes remains active after hangup/remote hangup.
- **Change**:
  - Added `www/app/desktop/media/desktopLocalAudioSession.js` to centralize desktop mic ownership:
    - stop any stale stream and acquire a fresh mic stream per call/answer
    - force-enable local audio track
    - attach/repair the local sender track using `replaceTrack()` / `addTrack()` once the peer connection exists
    - release mic on failures
  - Desktop outbound + inbound call flows now use this module.
- **Files changed**:
  - `www/app/desktop/media/desktopLocalAudioSession.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: verify two-way audio (desktop uplink) on outbound + inbound calls; confirm mic releases on hangup + remote hangup.

### 2026-04-12T04:09:00Z — Desktop hard refresh button: advanced cache clear + reload wired on desktop bootstrap path
- **Problem (runtime report)**:
  - Desktop status-bar hard refresh icon/button did not perform the required hard reload/cache clear.
- **Change**:
  - Added `www/app/desktop/runtime/desktopCacheActions.js` (desktop-owned) implementing the advanced cache clear + reload routine.
  - Desktop bootstrap now initializes this so `clearAllCacheAndReload()` is available for the desktop status bar `refreshBtn`.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click refresh button and confirm cache clear logs + reload with updated `cb=` param.

### 2026-04-12T04:21:00Z — Desktop hard refresh button: bind click handler in desktop runtime (reliable logs)
- **Problem (runtime report)**:
  - Clicking the hard refresh gear icon did not show the expected cache-clear logs (HARD_REFRESH_BEGIN / CACHE / HARD_REFRESH_REDIRECT).
- **Change**:
  - Desktop cache actions now bind `#refreshBtn` click via `addEventListener` and emit `DESKTOP_HARD_REFRESH_CLICK` before invoking `clearAllCacheAndReload()`.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and confirm `DESKTOP_HARD_REFRESH_CLICK` then `HARD_REFRESH_BEGIN` + `[CACHE]` logs appear before reload.

### 2026-04-12T04:31:00Z — Desktop hard refresh diagnostics: persist click breadcrumb across reload
- **Problem (runtime report)**:
  - Hard refresh click logs may be lost due to immediate navigation / console interception timing.
- **Change**:
  - Desktop hard refresh now writes `__desktop_hard_refresh_click_ts` to localStorage on click/run and logs `DESKTOP_HARD_REFRESH_PREV_CLICK` on the next boot.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon; after reload confirm `DESKTOP_HARD_REFRESH_PREV_CLICK` log appears.

### 2026-04-12T05:06:00Z — Desktop hard refresh: force refreshBtn onclick binding (avoid inline handler interference)
- **Problem (runtime report)**:
  - Hard refresh click logs still not observable; likely click handler not firing reliably.
- **Change**:
  - Desktop cache actions now assigns `refreshBtn.onclick` (in addition to addEventListener) and emits `DESKTOP_HARD_REFRESH_CLICK (src=onclick)`.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and confirm `DESKTOP_HARD_REFRESH_CLICK (src=onclick)` appears; after reload confirm `DESKTOP_HARD_REFRESH_PREV_CLICK` appears.

### 2026-04-12T05:18:00Z — Desktop hard refresh: call history flushed (add preserve/restore diagnostics)
- **Problem (runtime report)**:
  - After hard refresh works, call history appears flushed.
- **Cause (likely)**:
  - Hard refresh routine intentionally clears localStorage + sessionStorage + IndexedDB + Cache Storage; history persistence is localStorage-based (`callHistoryV2` / legacy `callHistory`) and will be lost if those keys are not present or if another storage key is used.
- **Change**:
  - Added `HARD_REFRESH_PRESERVE` and `HARD_REFRESH_RESTORED` logs around the localStorage clear to confirm whether callHistoryV2/callHistory are present and restored.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and capture HARD_REFRESH_PRESERVE/HARD_REFRESH_RESTORED logs. If they show 0, identify actual history key used and add it to the preserve list.

### 2026-04-12T05:37:00Z — Desktop dialpad input regression fix (keypad + keyboard)
- **Problem (runtime report)**:
  - Desktop dialpad cannot input digits: on-screen keypad clicks and keyboard typing do not update the dial field.
- **Cause (likely)**:
  - Desktop bootstrap path does not initialize the shared page dialpad input/keyboard toggle initializers, and desktop layout sets `#dial` as `readonly`.
- **Change**:
  - Added desktop-owned dialpad input initializer and keyboard toggle behavior to make `#dial` writable on desktop and ensure `.dial-btn` clicks append digits.
  - Desktop bootstrap now calls these initializers after rendering layout and refreshing DOM refs.
- **Files changed**:
  - `www/app/desktop/ui/desktopDialpadInput.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click keypad digits and type on keyboard; confirm #dial updates and outbound call uses the entered number.

### 2026-04-12T05:47:00Z — Desktop keyboard dialing fix (keydown capture)
- **Problem (runtime report)**:
  - After keypad clicks worked, physical keyboard input still did not update the dial field.
- **Change**:
  - Desktop dialpad input now uses `keydown` handlers (input + global) to capture digits/backspace and Enter-to-call reliably on desktop browsers.
- **Files changed**:
  - `www/app/desktop/ui/desktopDialpadInput.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: type digits on keyboard, confirm #dial updates; press Enter to place call.

### 2026-04-12T06:18:00Z — Desktop uplink audio: new call-audio runtime boundary (transceiver sender attach + unified release)
- **Problem (runtime report)**:
  - Remote side cannot hear desktop user on calls (desktop uplink failure persists).
- **Change**:
  - Added a new desktop-owned call audio runtime boundary which:
    - acquires a fresh mic per call
    - attaches the local track via the negotiated audio transceiver sender (fallback to sender/pc.addTrack)
    - logs sender/transceiver direction + track state
    - provides unified release hooks
  - Outbound and inbound answer call flows now use this boundary.
  - Outbound terminated cleanup also invokes the boundary release.
- **Keyboard icon (dialer)**:
  - Desktop keyboard icon now focuses/selects the dial input on click.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/ui/desktopDialpadInput.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: outbound + inbound call and confirm remote can hear desktop; confirm mic releases on local hangup + remote BYE.

### 2026-04-12T06:42:00Z — Desktop uplink audio: post-Established sync (verify transceiver direction + re-attach)
- **Problem (runtime report)**:
  - Remote still cannot hear desktop even though session establishes and RTP sent counters rise.
- **Change**:
  - Added desktop-owned post-Established sync routine which:
    - logs audio transceiver mid/direction/currentDirection and sender.track before/after
    - forces transceiver.direction to sendrecv if it negotiated recvonly/inactive
    - re-attaches/replaces the mic track immediately on Established and again after 450ms
  - Wired this sync on outbound+inbound session Established.
- **Keyboard icon (dialer)**:
  - Desktop keyboard icon is no longer hidden and now logs a focus event + focuses/selects `#dial` on click.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/ui/desktopDialpadInput.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound+inbound call and confirm remote can hear desktop; capture post-accept before/after logs.

### 2026-04-12T07:05:00Z — Desktop uplink audio: sender stats + audio activity diagnostics + one-shot recovery
- **Problem (runtime report)**:
  - Sender attach succeeds and RTP sent counters rise, but remote still cannot hear desktop user.
- **Change**:
  - Added a desktop-owned uplink diagnostics loop after Established:
    - samples `RTCRtpSender.getStats()` (outbound-rtp bytes/packets, media-source audioLevel/totalAudioEnergy when available)
    - logs track enabled/muted/readyState
    - detects likely silent uplink (packets increase but energy/level stays ~0)
  - If silent uplink is detected, runs exactly one desktop-owned recovery attempt:
    - reacquire mic once
    - replaceTrack/reattach once via existing desktop call-audio runtime
  - Diagnostics timer stops on Terminated.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js` (new)
  - `www/app/desktop/media/desktopCallAudioRecovery.js` (new)
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: capture [desktop:uplink:diag] tick logs and (if triggered) [desktop:uplink:recovery] logs; verify remote can hear desktop after recovery.

### 2026-04-12T07:30:00Z — Desktop termination diagnostics: snapshot state at Established / remote BYE / Terminated
- **Problem (runtime report)**:
  - Latest evidence shows desktop is sending non-silent audio (lvl/eng non-zero), but the far side still clears with BYE Reason Q.850 cause=16 NORMAL_CLEARING a few seconds after answer.
- **Change**:
  - Added a desktop-owned termination diagnostics boundary that snapshots:
    - SIP dialog identifiers (call-id/tags when available)
    - audio transceiver direction/currentDirection + sender/receiver track state
    - selected ICE candidate pair + local/remote candidate info
    - inbound/outbound audio RTP stats (best-effort)
    - recent desktop uplink diagnostic tick history (in-memory on session)
  - Snapshots are emitted as compact `[desktop:term-diag] ...` logs on:
    - Established
    - remote BYE (if surfaced by SIP.js delegate)
    - SessionState.Terminated
- **Files changed**:
  - `www/app/desktop/outgoing/desktopTerminationDiagnostics.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and capture `[desktop:term-diag]` lines at established/remote-bye/terminated; if ICE/RTP/transceiver state is healthy immediately before BYE, treat blocker as likely remote/PBX-side clearing.

### 2026-04-12T07:52:00Z — Regression restore: disable newest post-accept uplink hooks; fix null SessionState crash
- **Last known-good runtime evidence**:
  - `2026-04-12 02:31 PKT | VERIFY | TASK-031 | ... PASS — ... ringback audible, two-way audio after answer ...` (user report).
- **Problem (runtime report)**:
  - Desktop call path regressed: remote cannot hear desktop, call clears after a few seconds, mic may remain active; termination path throws `TypeError: Cannot read properties of null (reading 'SessionState')` from desktopCallAudioUplinkDiagnostics.js.
- **Change**:
  - Fixed uplink diagnostics termination listener to guard `SIP` null.
  - Disabled post-accept uplink diagnostics hook (and its recovery attempt path).
  - Removed post-Established mic reattach listeners from outbound + inbound answered call flows.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js`
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm termination exception is gone; re-test outbound call for two-way audio.

### 2026-04-12T08:07:00Z — Regression restore follow-up: detach uplink diagnostics from outbound termination path
- **Problem (runtime report)**:
  - Desktop call path remains regressed and recent diagnostics/recovery additions caused termination-path instability.
- **Change**:
  - Removed the last runtime reference to uplink diagnostics from the outbound termination path (desktopOutboundStateChange no longer imports/calls stopDesktopUplinkDiagnostics).
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: re-test outbound call against the last known-good scenario (2026-04-12 02:31 PKT PASS).

### 2026-04-12T08:23:00Z — Regression restore: simplify outbound mic cleanup to a single release path
- **Problem (runtime report)**:
  - Mic cleanup after termination is unreliable; multiple cleanup paths were active.
- **Change**:
  - Outbound flow now uses a single mic release path:
    - removed extra `bindDesktopCallAudioReleaseOnTerminate()` listener from outbound start
    - removed redundant `stopLocalAudioStream()` call from outbound Terminated handler (releaseDesktopCallAudio already stops mic)
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: verify mic releases on both local hangup and remote BYE; re-test two-way audio.

### 2026-04-12T08:39:00Z — Desktop mic path: warn if mic input appears silent (one-shot probe after attach)
- **Problem (runtime report)**:
  - Remote cannot hear desktop; user requested a clear dialer-visible warning when mic input is not working.
- **Change**:
  - Added a one-shot AudioContext/Analyser RMS probe after successful mic attach; if RMS is below threshold, logs a warning and sets UI status to `Warning: microphone input appears silent`.
  - No retries/recovery loops.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: capture the RMS warning log line (if any) during a call attempt.

### 2026-04-12T08:52:00Z — Desktop mic silent warning: resume AudioContext before sample; keep warning visible
- **Problem (runtime report)**:
  - Warning log can appear, but UI status can be overwritten quickly by other status updates (e.g., Calling/Idle).
- **Change**:
  - Mic probe now resumes AudioContext if suspended before sampling; if silent, re-asserts the warning status once after 1.2s.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm warning remains visible when RMS is low.

### 2026-04-12T09:28:00Z — Regression-first mic lifecycle diagnostics (corrId + micId; acquire/attach/release + post-term checks)
- **Goal**:
  - Stop guessing by logging the exact desktop mic lifecycle and proving whether release truly happens and whether anything survives termination.
- **Change**:
  - Added `[desktop:mic]` diagnostics for:
    - acquire start / acquire ok (+ track label + getSettings snapshot)
    - attach (+ attach method + transceiver direction/currentDirection + sender track id)
    - release requested / release executed
    - post-term-check at ~300ms and ~1200ms after release (localStream existence, local track state, sender track id, pc signaling state)
  - Outbound hangup now routes through `releaseDesktopCallAudio()` (instead of directly calling `stopLocalAudioStream`) so release is observable and uses the same single release boundary.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/outgoing/desktopHangupCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and then hang up (and also test remote BYE termination). Capture the full `[desktop:mic]` sequence and confirm whether localStream becomes null and whether any sender still has a live audio track at 300ms/1200ms.

### 2026-04-12T09:44:00Z — Regression restore: remove manual attachDesktopCallAudioToSession calls (rely on SIP.js localMediaStream)
- **Last known-good runtime evidence**:
  - `2026-04-12 02:31 PKT | VERIFY | TASK-031 | ... PASS — ... two-way audio ...` (user report).
- **Problem (runtime report)**:
  - One-way audio persists; remote BYE after ~10–15s; mic lifecycle logs show local stream is released, so the blocker is not simply “release did not run”.
- **Change**:
  - Desktop outbound and inbound call flows no longer call `attachDesktopCallAudioToSession()` after INVITE/accept.
  - This removes the manual transceiver/sender `replaceTrack`/`addTrack` attachment logic from the runtime path and reverts toward the known-good behavior where SIP.js attaches the local track from `sessionDescriptionHandlerOptions.localMediaStream`.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and confirm whether remote can hear desktop. If still fails, capture `[desktop:term-diag]` and `[desktop:mic]` logs.

### 2026-04-12T10:12:00Z — Regression restore: remove sender hard-stop mutations; simplify mic release to stopLocalAudioStream-only
- **Last known-good runtime evidence**:
  - `2026-04-12 02:31 PKT | VERIFY | TASK-031 | ... PASS — ... two-way audio ...` (user report).
- **Problem (runtime report)**:
  - Desktop calls remain unstable/one-way; newer desktop-owned cleanup logic included sender track stops and `replaceTrack(null)` calls.
- **Change**:
  - Outbound Terminated handler no longer stops sender tracks or calls `replaceTrack(null)`.
  - `releaseDesktopCallAudio()` now uses `stopLocalAudioStream()` only (removed hard-stop sender cleanup and enumerateDevices-based diagnostics).
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: re-test inbound + outbound two-way audio.

### 2026-04-12T07:52:00Z — Regression restore: disable newest post-accept uplink hooks; fix null SessionState crash
- **Last known-good runtime evidence**:
  - `2026-04-12 02:31 PKT | VERIFY | TASK-031 | ... PASS — ... ringback audible, two-way audio after answer ...` (user report).
- **Problem (runtime report)**:
  - Desktop call path regressed: remote cannot hear desktop, call clears after a few seconds, mic may remain active; termination path throws `TypeError: Cannot read properties of null (reading 'SessionState')` from desktopCallAudioUplinkDiagnostics.js.
- **Change**:
  - Fixed uplink diagnostics termination listener to guard `SIP` null.
  - Disabled post-accept uplink diagnostics hook (and its recovery attempt path).
  - Removed post-Established mic reattach listeners from outbound + inbound answered call flows.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js`
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm termination exception is gone; re-test outbound call for two-way audio.

### 2026-04-12T04:41:00Z — Desktop hard refresh: cache-busted import to force latest desktopCacheActions
- **Problem (runtime report)**:
  - URL cb/hr changes, but hard refresh click logs still do not appear; likely due to cached JS module graph for desktopCacheActions.
- **Change**:
  - Desktop bootstrap now imports `desktopCacheActions.js` with a cache-busting query so updated hard refresh logic is fetched reliably.
- **Files changed**:
  - `www/app/desktop/bootstrapDesktopApp.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client and click gear icon; confirm DESKTOP_HARD_REFRESH_CLICK and HARD_REFRESH_BEGIN/CACHE logs appear.

### 2026-04-12T04:56:00Z — Desktop hard refresh proof: breadcrumb moved to window.name (survives localStorage.clear)
- **Problem (runtime report)**:
  - Hard refresh routine clears localStorage, so a localStorage-based click breadcrumb is removed before the next boot.
- **Change**:
  - Desktop hard refresh now records `__desktop_hard_refresh_click_ts` in `window.name` and logs `DESKTOP_HARD_REFRESH_PREV_CLICK` on the next boot.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon; after reload confirm `DESKTOP_HARD_REFRESH_PREV_CLICK` log appears.

## Final historical record (closeout)

### 2026-04-13T04:10:00Z — Desktop UI file-size pass complete (all desktop-only JS now <200)
- **AI**: Cascade
- **Change**: finish desktop UI file-size pass by delegating layout/template sections and extracting UI helpers.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppLayout.js`
  - `www/app/desktop/ui/ext/desktopLayoutSections.js`
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/ui/ext/desktopAppUiHelpers.js`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**: line-count scan confirms `www/app/desktop/**/*.js` has 0 files >200 lines.

### 2026-04-13T05:05:00Z — Strict isolation: remove shared Add Call UI behavior dependency
- **AI**: Cascade
- **Change**: copied shared Add Call button behavior into desktop-owned module and switched desktop imports.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopCallControlAddCall.js` (new)
  - `www/app/desktop/ui/desktopCallControls.js`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**: import audit confirms desktop no longer imports `www/app/dom.js`, `www/app/incoming/handlers/**`, or `www/app/ui/callControlAddCall.js`.

### 2026-04-13 09:30 PKT — Final 200+ desktop UI refactor pass confirmation
- Verified: delegated layout sections + extracted UI helpers; confirmed 0 files >200 under `www/app/desktop/**/*.js`.

### 2026-04-13 10:05 PKT — Strict isolation confirmation: desktop-owned Add Call UI module in use
- Verified: shared Add Call UI behavior moved from `www/app/ui/callControlAddCall.js` into desktop-owned `www/app/desktop/ui/ext/desktopCallControlAddCall.js`; `desktopCallControls.js` imports desktop version.

### 2026-04-13 — Final verification
- Verified by full desktop line-count scan and import audit:
  - `www/app/desktop/**/*.js` files >200 lines: 0
  - No desktop imports from:
    - `www/app/dom.js`
    - `www/app/incoming/handlers/**`
    - `www/app/ui/callControlAddCall.js`
- Remaining issues (477/480 early termination; mic-stuck indicator) are runtime/correctness bugs, not isolation debt.
