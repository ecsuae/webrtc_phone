# NOW

## Current task
TASK-031 — desktop app refactor/isolation (standalone; no shared code with Android/iOS).

## Why this matters
Desktop app code isolation reduces cross-platform coupling risk and makes desktop behavior (including registration) explicit, maintainable, and desktop-owned.

## Task status (truthful)
- TASK-028: complete (push-server isolation + `/admin/calllogs` summary diagnosis work complete enough; do not reopen).
- TASK-029: pending (missing inbound raw proof rows in raw logs).
- TASK-030: complete enough to close (template-driven runtime config is in place and verified; optional websocket Upgrade probe is deferred).
- TASK-031: active (desktop app refactor/isolation).

## Scope guardrails (for current work)
- Scope: desktop app refactor/isolation only.
- Desktop must become standalone with no shared/common code dependency on Android or iOS.
- Desktop must not use shared/common registration code; registration must be desktop-owned.
- Do not modify Android or iOS implementation in this step.
- Do not mix with TASK-029 missing inbound raw proof rows.
- Do not touch push-server summary/logging/admin.

## Already proven (TASK-031)
- Desktop inventory recorded in `docs/tasks/TASK-031.md`:
  - Desktop entrypoints/build wiring identified (`www/index.html` → `app/page/bootstrapPage.js` → `app/main.js` → `runtime/desktop/bootstrapDesktop.js`).
  - Desktop currently depends on shared/common modules (including shared/common registration via `sipRegister.js` / `registration/*`).
- Step 1 implemented (behavior-preserving): desktop branch now boots via desktop-owned entrypoint `www/app/desktop/bootstrapDesktopApp.js`.
- Step 2 implemented (desktop-owned registration): desktop bootstrap now uses `www/app/desktop/registration/desktopRegistration.js` and no longer routes desktop registration through `sipRegister.js` / `runtime/registerFlow.js` / `registration/*`.
- Step 3 implemented (desktop-owned call-control bindings): desktop call flow no longer imports `www/app/runtime/shared/controlBindingsCore.js`.
- Step 4 implemented (desktop-owned runtime hooks): desktop bootstrap no longer imports `www/app/runtime/mobileRecovery.js` or `www/app/runtime/swWakeHandler.js`.
- Step 5 in progress: desktop-owned platform adapter registry exists (`www/app/desktop/runtime/platformAdapterRegistry.js`) and desktop bootstrap no longer imports `www/app/runtime/shared/platformAdapter.js`.
- Step 5 progress: desktop outbound call uses desktop-owned ringback/provisional delegate (`www/app/desktop/outgoing/*`) and no longer routes ringback/provisional handling through shared `www/app/outgoing/ringback/index.js`.
- Step 5 progress: desktop outbound media/audio-route enforcement is desktop-owned (`www/app/desktop/outgoing/desktopOutgoingMedia.js`) and no longer routes through shared `www/app/outgoing/media.js` (shared `requirePlatformAdapter()` dependency).
- Step 5 progress: desktop incoming ringtone priming is desktop-owned (`www/app/desktop/incoming/desktopIncomingAlert.js`) and no longer routes through shared `www/app/incoming/alert/ringtone.js` (shared `requirePlatformAdapter()` dependency).
- Step 5 progress: desktop incoming stop/cleanup alert path is desktop-owned (`www/app/desktop/incoming/desktopIncomingAlert.js`) and desktop no longer imports shared `www/app/incoming/alert.js` / `www/app/incoming/alert/*`.
- Step 5 progress: desktop layout now includes incoming alert banner nodes (`incomingAlertBanner`/`incomingAlertTitle`) required by `desktopIncomingAlert.startIncomingAlert`.
- Step 5 progress: desktop now renders a desktop-owned registration+dialpad layout module (`www/app/desktop/ui/desktopAppLayout.js`) on desktop only.
- Step 5 progress: desktop app shell sections are desktop-owned (`www/app/desktop/ui/desktopShellSections.js`); desktop no longer imports shared layout header/status/log sections for desktop shell.
- Step 5 progress: desktop now uses desktop-owned DOM refs cache (`www/app/desktop/ui/desktopDomRefs.js`) for registration+dialpad+incoming-alert UI (shared `www/app/dom.js` not used in this boundary).
- Step 5 progress: desktop incoming attach-audio is desktop-owned (`www/app/desktop/incoming/desktopIncomingRemoteAudio.js`) and desktop answer flow no longer uses shared `www/app/incoming/media/attachIncomingRemoteAudio.js` (shared `requirePlatformAdapter()` dependency).
- Step 5 progress: desktop global audio-route enforcement is desktop-owned (`www/app/desktop/ui/*`) and desktop no longer imports shared `www/app/ui/audioRoute/enforce.js` (shared `requirePlatformAdapter()` dependency).
- Step 5 progress: desktop Established-state incoming attach path is desktop-owned (`www/app/desktop/incoming/desktopOnIncomingEstablished.js`) and desktop no longer depends on shared `www/app/incoming/handlers/onEstablished.js` for established handling / attach.
- Step 5 progress: desktop outbound hangup is desktop-owned (`www/app/desktop/outgoing/desktopHangupCall.js`) and desktop no longer imports shared `www/app/outgoing/call/hangupCall.js` (which pulls shared ringback/platform adapter).
- Step 5 progress: desktop UI orchestration is desktop-owned (`www/app/desktop/ui/desktopAppUi.js`); desktop bootstrap no longer imports shared `www/app/ui/appUi.js`.
- Step 5 progress: desktop history/timer UI support is desktop-owned (`www/app/desktop/ui/desktopUiSupport*.js`); desktop bootstrap no longer imports shared `www/app/ui/historyActivity.js` or `www/app/ui/callTimer.js`.
- Step 5 progress: desktop logging + timestamps are desktop-owned (`www/app/desktop/desktopLogging.js`); desktop bootstrap no longer imports shared `www/app/log.js` or `www/app/config.js`.
- Step 5 progress: desktop runtime modules now use desktop-owned logging (`desktopLogging.js`) throughout (12 modules updated: desktopStartCall, desktopIncomingAlert, desktopHangupCall, desktopOutboundStateChange, desktopAnswerIncomingCall, desktopIncomingEstablished, desktopOnIncomingEstablished, desktopCallControls, desktopIncomingRemoteAudio, desktopIncomingRemoteAudioSupport, desktopRingbackDelegate, desktopOutgoingMedia, desktopControlBindings).
- Step 5 progress: desktop session recovery is desktop-owned (`www/app/desktop/desktopRecoverySession.js`); desktop bootstrap and registration no longer import shared `www/app/push/recoverySession.js`.
- Step 5 progress: desktop remote logging is now wrapped in desktop-owned module (`www/app/desktop/desktopRemoteLogs.js`); desktop bootstrap no longer directly imports shared `www/app/remoteLogs.js`.
- Step 5 progress: desktop incoming call reject is desktop-owned (`www/app/desktop/incoming/desktopRejectIncomingCall.js`); desktop control bindings no longer import shared `www/app/sipCallIncoming.js` for reject.
- Step 5 progress: desktop tab navigation is desktop-owned (`www/app/desktop/ui/desktopTabNavigation.js`); desktop control bindings no longer import shared `www/app/ui/tabNavigation.js`.
- Step 5 progress: desktop incoming state cleanup is desktop-owned (`www/app/desktop/incoming/desktopIncomingState.js`); desktop answer flow no longer imports shared `www/app/incoming/handlers/state.js`.
- Step 5 progress: desktop conference join is desktop-owned (`www/app/desktop/conference/desktopJoinConference.js`); desktop control bindings no longer import shared `www/app/conference/join.js`.
- Step 5 progress: desktop LTE relay readiness guard is desktop-owned (`www/app/desktop/desktopLteCallGuard.js`); desktop call flows no longer import shared `www/app/features/lteCallGuard.js`.
- Step 5 progress: desktop outbound-call-start support is desktop-owned (`www/app/desktop/outgoing/desktopStartCallSupport.js`, `www/app/desktop/outgoing/desktopStartCallPreflight.js`); desktopStartCall no longer imports shared `www/app/outgoing/call/*`.

## Current blocker
- Desktop runtime: remaining issue is OS/browser mic indicator staying active after hangup, even though app-level teardown now proves:
  - local mic track is stopped (readyState=ended)
  - local stream cleared (localStream=no)
  - sender has no audio track
  - active capture registry returns to 0

- Desktop UI controls: Log Off visibility is now proven fixed by runtime user report; earpiece/record hide still require runtime re-check after reload.

- Desktop hard refresh control (status bar gear icon) needed desktop-owned advanced cache clear + reload wiring; fix applied, runtime click verification pending.

## Files most likely involved (TASK-031)
- `docs/tasks/TASK-031.md`
- Desktop app source tree (to be identified via inventory)
- Any current desktop entrypoints/build wiring (to be identified via inventory)

## Exact next safe step
Runtime/browser: place a desktop outbound call and hang up. Use the desktop mic ownership tracker snapshots emitted after release to identify any remaining mic owner:
- `[desktop:mic-owner] hooks installed` (once at startup)
- `[desktop:mic-owner] snapshot ... checkpoint=post-release ... ownerCount=... liveOwnerCount=...`
- `[desktop:mic-owner] snapshot ... checkpoint=post-release-1500ms ...`

Snapshots now include a compact `live=...` summary in posted logs (with acquisition hint) and legacy `navigator.getUserMedia`/`webkitGetUserMedia` are also tracked.

If a remaining owner is shown (AudioContext / MediaStreamSource / getUserMedia), fix the leak in the responsible desktop-owned module by closing/disconnecting/stopping it.