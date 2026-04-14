# NOW

## Current task
TASK-032 — Desktop runtime/correctness (ext-to-ext one-way audio proof/fix).

## Current blocker(s)
- Ext-to-ext one-way audio symptom: 992003 cannot hear 900900.
- Latest logs prove this is not an ICE/connectivity failure (900900 sends RTP; 992003 receives RTP), so the likely fault boundary is desktop inbound-answer sender binding / silent-source on 900900.

## Exact next safe step
- Reproduce one failing ext-to-ext call and inspect inbound leg proof:
  - `desktop-inbound-audio-proof` (~2.5s and ~10s after Established)
  - senderTrackId == acquired local mic trackId
  - outbound RTP packets/bytes increasing
  - sender energy (audioLevel/totalAudioEnergy) non-zero when speaking
- If binding is correct but energy stays near-zero, treat as local capture/silent-source; do not guess-fix outside desktop inbound boundary.

## Why this matters
TASK-032 must be resolved with proof: one-way audio can be caused by sender binding, PBX bridge, codec/SDP asymmetry, or far-end receive/render.

## Task status (truthful)
- TASK-028: complete (push-server isolation + `/admin/calllogs` summary diagnosis work complete enough; do not reopen).
- TASK-029: pending (missing inbound raw proof rows in raw logs).
- TASK-030: complete enough to close (template-driven runtime config is in place and verified; optional websocket Upgrade probe is deferred).
- TASK-031: complete/closed (desktop isolation/refactor is complete; remaining issues are runtime-only bugs).
- TASK-032: active (runtime proof/fix in progress; do not guess-fix without evidence).
- TASK-033: pending (admin registrations page continues later).

## Scope guardrails (for current work)
- Scope: desktop runtime proof/fix only (TASK-032).
- Do not reopen desktop isolation/refactor (TASK-031).
- Do not change SIP routing/server behavior in this step.
- Add only minimal decisive diagnostics until the failing segment is proven.

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
- Runtime bug: desktop outbound extension-to-extension calls may reject/terminate early (477/480).
- Runtime issue: OS/browser mic indicator may remain on after hangup despite app-level release proof.
- Note: these are runtime/correctness bugs; desktop isolation/refactor is not the blocker.

## Files most likely involved (TASK-031)
- `docs/tasks/TASK-031.md`
- Desktop app source tree (to be identified via inventory)
- Any current desktop entrypoints/build wiring (to be identified via inventory)

## Exact next safe step
Desktop isolation/refactor is complete. Next safe step: runtime-only debugging to reproduce and fix 477/480 early termination and any mic-stuck indicators (no refactors unless a file grows beyond the ceiling).