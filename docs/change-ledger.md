# Change Ledger

_This is a live, rotating ledger of every meaningful change made to this repo._

## Rules (mandatory)

- Update this file **before ending every AI session**.
- **Append-only:** do not overwrite history. Add new entries without deleting prior real entries.
- **Consistent ordering:** append new entries either at the top or the bottom consistently. This file uses **newest-first** under “Current week entries”.
- **Corrections:** never rewrite prior real entries except to correct factual mistakes. If you correct an entry, add a new timestamped note describing what was corrected.
- Every entry MUST include:
  - timestamp
  - AI signature/name (Claude / Windsurf / ChatGPT / other)
  - exact files changed
  - restart required (exact service(s) + command if known) or **no restart required**
  - exact verified result (what you actually confirmed)
  - next safe step
- **Do not let this file grow forever.**
  - When this file reaches ~400 lines, rotate/archive it.
  - Archive weekly using week-range filenames like:
    - `2026-03-23_to_2026-03-29_change-ledger.md`
  - Put archived files in the correct month folder under:
    - `Work_Flow/2026/03-Mar/`
  - Keep only the current live file in `docs/`.
  - After rotation, create a fresh trimmed live file in `docs/` containing only the current essential state.

---


## Live index (keep this file small)

### Task histories (authoritative)
- TASK-027: `docs/tasks/TASK-027.md`
- TASK-028: `docs/tasks/TASK-028.md`
- TASK-029: `docs/tasks/TASK-029.md`
- TASK-030: `docs/tasks/TASK-030.md`
- TASK-031: `docs/tasks/TASK-031.md`

### Archives
- April 2026 archive (verbatim ledger snapshot): `docs/archive/change-ledger-2026-04.md`

### Recent activity pointers
- TASK-031 Step 5 progress (desktop isolation): see `docs/tasks/TASK-031.md`

## Current week entries

### 2026-04-12T18:58:00Z — TASK-031: desktop mic ownership tracker (identify second mic owner)
- **AI**: Cascade
- **Scope**: desktop-only observability + safe teardown snapshot; no push-server changes; no SIP/media negotiation changes.
- **Files changed**:
  - `www/app/desktop/media/desktopMicOwnershipHooks.js`
  - `www/app/desktop/media/desktopMicOwnershipTracker.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: reload desktop web app.
- **Verified result**:
  - Not yet runtime verified (requires a desktop call + hangup). Expected evidence: post-release snapshots include `msg` with a compact `live=...` owner summary; console includes full `owners` object.
- **Next safe step**:
  - Runtime test: place call, hang up, check which owner remains. If an AudioContext/MediaStreamSource remains open, close/disconnect it in the responsible desktop-owned module.

### 2026-04-12T18:40:00Z — TASK-031: desktop outbound media fix + teardown observability (two-way audio restored; mic-release proof)
- **AI**: Cascade
- **Scope**: desktop outbound media stability + teardown observability; no behavior changes outside media attachment/teardown evidence.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `www/app/media.js`
  - `push-server/src/services/callLogStore.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: reload desktop web app; rebuild/restart push-server for sanitizer changes.
- **Verified result**:
  - Runtime verified: desktop outbound calls have two-way audio; teardown logs show local stream cleared, sender track detached, active capture registry returns to 0.
- **Next safe step**:
  - Observability-only: search for second mic owner outside call lifecycle (additional gUM / AudioContext MediaStreamSource / preview paths). Capture global snapshot after hangup.

### 2026-04-12T10:23:00Z — TASK-031: uplink regression restore (re-acquire mic if cached track not live; emit outbound audio level/energy)
- **AI**: Cascade
- **Scope**: desktop-first uplink stability; shared media/stats modules adjusted to restore reliable fresh mic track and improve evidence.
- **Files changed**:
  - `www/app/media.js`
  - `www/app/pc/stats/audioSnapshot.js`
  - `www/app/pc/stats/schedule/tick.js`
  - `www/app/pc/stats/schedule/tickOutbound.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/outgoing/call/diagContext.js`
  - `push-server/src/services/callLogExport.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Not yet (runtime required).
- **Next safe step**:
  - Runtime/browser: outbound call; confirm remote hears desktop; confirm senderTrackId/senderTrackReadyState and outboundAudioLevel/outboundTotalAudioEnergy fields in `outbound-stats-2s/5s/10s`.

### 2026-04-12T10:12:00Z — TASK-031: regression restore (remove sender hard-stop mutations; simplify mic release to stopLocalAudioStream-only)
- **AI**: Cascade
- **Scope**: desktop-only rollback toward previously documented working media lifecycle.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: verify inbound + outbound two-way audio; if remote BYE still occurs, capture `[desktop:term-diag]` and `[desktop:mic]` logs.

### 2026-04-12T09:44:00Z — TASK-031: regression restore (remove manual post-invite/post-accept mic attach; rely on SIP.js localMediaStream)
- **AI**: Cascade
- **Scope**: desktop-only rollback toward known-good attachment behavior. No recovery loops.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and confirm whether remote can hear desktop again (two-way audio). If still fails, capture `[desktop:mic]` acquire/release logs and `[desktop:term-diag]` snapshots.

### 2026-04-12T09:28:00Z — TASK-031: desktop mic lifecycle diagnostics (corrId + micId; acquire/attach/release + post-term checks)
- **AI**: Cascade
- **Scope**: desktop-only runtime diagnostics; no recovery behavior added.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/outgoing/desktopHangupCall.js`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call; capture `[desktop:mic] acquire/attach/release/post-term-check` logs and confirm whether localStream is cleared and sender track is detached after termination.

### 2026-04-12T08:52:00Z — TASK-031: mic silent warning probe reliability (resume AudioContext; re-assert status)
- **AI**: Cascade
- **Scope**: desktop-only UI warning tweak.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: confirm warning remains visible when RMS is low and capture the warning log line.

### 2026-04-12T08:39:00Z — TASK-031: desktop mic silent warning (one-shot probe after attach)
- **AI**: Cascade
- **Scope**: desktop-only UI warning. No recovery logic.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place a call and confirm a warning appears if mic is muted/silent; capture RMS warning log if present.

### 2026-04-12T08:23:00Z — TASK-031: regression restore (simplify outbound mic cleanup to single release path)
- **AI**: Cascade
- **Scope**: desktop-only rollback/simplification. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: verify remote BYE and local hangup both release mic reliably (no stuck mic) and re-test two-way audio.

### 2026-04-12T08:07:00Z — TASK-031: regression restore follow-up (detach uplink diagnostics module from outbound termination)
- **AI**: Cascade
- **Scope**: desktop-only rollback. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: re-test outbound call against the last known-good scenario (2026-04-12 02:31 PKT PASS) and confirm mic releases on remote BYE/hangup.

### 2026-04-12T07:52:00Z — TASK-031: regression restore (disable uplink diag hook + remove post-Established reattach; fix null SessionState crash)
- **AI**: Cascade
- **Scope**: desktop-only rollback/fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js`
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place call and confirm no termination exception occurs; re-test two-way audio against the last known-good scenario logged at 2026-04-12 02:31 PKT.

### 2026-04-12T07:30:00Z — TASK-031: desktop termination diagnostics (Established / remote BYE / Terminated snapshots)
- **AI**: Cascade
- **Scope**: desktop-only runtime diagnostics. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopTerminationDiagnostics.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and capture [desktop:term-diag] lines at established, remote-bye, terminated; confirm ICE selected pair + RTP stats + transceiver state are healthy immediately before remote clear.

### 2026-04-12T07:05:00Z — TASK-031: desktop uplink diagnostics (sender stats + audio energy/level) + one-shot recovery
- **AI**: Cascade
- **Scope**: desktop-only media path. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioUplinkDiagnostics.js` (new)
  - `www/app/desktop/media/desktopCallAudioRecovery.js` (new)
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place call and capture [desktop:uplink:diag] tick logs; confirm whether lvl/eng increases; if recovery runs, capture [desktop:uplink:recovery] logs and confirm remote can hear desktop.

### 2026-04-12T06:42:00Z — TASK-031: desktop post-Established uplink sync (transceiver direction + re-attach) + keyboard icon focus
- **AI**: Cascade
- **Scope**: desktop-only media path + dialer input affordance. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopCallAudioPostAccept.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/ui/desktopDialpadInput.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound + inbound call and confirm remote can hear desktop; capture [desktop:call-audio] post-accept before/after logs; click keyboard icon and confirm [desktop:dialpad] focus log.

### 2026-04-12T06:18:00Z — TASK-031: desktop call audio runtime boundary (attach via transceiver sender + unified release)
- **AI**: Cascade
- **Scope**: desktop-only media path. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/media/desktopCallAudioRuntime.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/ui/desktopDialpadInput.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: outbound + inbound call and confirm remote can hear desktop; confirm mic releases on local hangup + remote BYE; confirm keyboard icon focuses #dial.

### 2026-04-12T05:47:00Z — TASK-031: desktop keyboard dialing fixed (keydown capture)
- **AI**: Cascade
- **Scope**: desktop-only dialpad input. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopDialpadInput.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: type digits on physical keyboard; confirm #dial updates and Enter triggers Call.

### 2026-04-12T05:37:00Z — TASK-031: desktop dialpad input fixed (keypad clicks + keyboard typing)
- **AI**: Cascade
- **Scope**: desktop-only UI input wiring. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopDialpadInput.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click keypad digits and type on keyboard; confirm #dial updates and Call button uses the entered number.

### 2026-04-12T05:18:00Z — TASK-031: desktop hard refresh call history diagnostics (preserve/restore logs)
- **AI**: Cascade
- **Scope**: desktop-only hard refresh diagnostics. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and capture HARD_REFRESH_PRESERVE/HARD_REFRESH_RESTORED logs; if lengths are 0, identify actual storage key used for history and preserve it.

### 2026-04-12T05:06:00Z — TASK-031: desktop hard refresh button forced onclick binding (ensure click handler runs)
- **AI**: Cascade
- **Scope**: desktop-only runtime wiring. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and confirm DESKTOP_HARD_REFRESH_CLICK (src=onclick) appears; after reload confirm DESKTOP_HARD_REFRESH_PREV_CLICK appears.

### 2026-04-12T04:56:00Z — TASK-031: desktop hard refresh proof breadcrumb now uses window.name (survives storage clear)
- **AI**: Cascade
- **Scope**: desktop-only runtime diagnostics. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon; after reload confirm DESKTOP_HARD_REFRESH_PREV_CLICK appears on boot.

### 2026-04-12T04:41:00Z — TASK-031: desktop cache-busted import for hard refresh module (force latest JS)
- **AI**: Cascade
- **Scope**: desktop-only module-load cache bust. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client and click gear icon; confirm DESKTOP_HARD_REFRESH_CLICK / HARD_REFRESH_BEGIN / CACHE logs appear.

### 2026-04-12T04:31:00Z — TASK-031: desktop hard refresh breadcrumb logging (prove click across reload)
- **AI**: Cascade
- **Scope**: desktop-only runtime diagnostics for hard refresh. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon; after reload confirm DESKTOP_HARD_REFRESH_PREV_CLICK appears on boot.

### 2026-04-12T04:21:00Z — TASK-031: desktop hard refresh click binding (emit click marker + run clear routine)
- **AI**: Cascade
- **Scope**: desktop-only runtime wiring. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click gear icon and confirm DESKTOP_HARD_REFRESH_CLICK then HARD_REFRESH_BEGIN + CACHE logs appear before reload.

### 2026-04-12T04:09:00Z — TASK-031: desktop hard refresh button now runs advanced cache clear + reload
- **AI**: Cascade
- **Scope**: desktop-only runtime cache clear wiring. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/runtime/desktopCacheActions.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click the gear refresh button and confirm logs show HARD_REFRESH_BEGIN and that app reloads with a new cb= query param.

### 2026-04-12T03:51:00Z — TASK-031: desktop local mic ownership boundary (fresh acquire + sender attach/replace + release)
- **AI**: Cascade
- **Scope**: desktop-only media path (local mic acquire/attach/release). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/media/desktopLocalAudioSession.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/now.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: verify two-way audio (desktop uplink) on outbound + inbound calls; confirm mic releases on hangup + remote hangup.

### 2026-04-12T03:22:00Z — TASK-031: desktop outbound terminated now stops local mic stream (remote hangup cleanup)
- **AI**: Cascade
- **Scope**: desktop-only call end cleanup. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime: place outbound call, have remote hang up, confirm mic indicator turns off and next call has two-way audio.

### 2026-04-12T03:05:00Z — TASK-031: desktop UI controls follow-up (logOffBtn sync in setStatus; keep earpiece hidden)
- **AI**: Cascade
- **Scope**: desktop-only UI controls. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/ui/desktopCallControls.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: after reload, confirm logOffBtn visible on dialer when registered; confirm earpiece/record remain hidden.

### 2026-04-12T02:54:00Z — TASK-031: desktop UI controls fixed (Log Off icon on dialer; hide earpiece + record)
- **AI**: Cascade
- **Scope**: desktop-only UI controls. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/ui/desktopCallControls.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only (logOffBtn display toggled on registered; btnSpeaker/btnRecord forced hidden on desktop).
- **Next safe step**:
  - Runtime/browser: after reload, confirm Log Off icon visible on dialer when registered and confirm earpiece/record controls are hidden.

### 2026-04-12T02:41:00Z — TASK-031: desktop UI regressions fixed (Log Off visibility + timer stop/reset on hangup)
- **AI**: Cascade
- **Scope**: desktop-only UI/state bugfix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppUi.js`
  - `www/app/desktop/outgoing/desktopHangupCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only (btnStop display fixed; callTimer.stop invoked on call end paths).
- **Next safe step**:
  - Runtime/browser: re-test Log Off visibility + call timer stops after hangup on real desktop entrypoint path.

### 2026-04-12T02:31:00Z — TASK-031: runtime/browser verification (partial) recorded; task remains active
- **AI**: Cascade
- **Scope**: verification-only; no code changes.
- **Files changed**:
  - `docs/session-log.md`
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Runtime/browser evidence (user report): PASS — Enable Calls (one click), outbound INVITE, ringback audible, two-way audio after answer, hangup/end, incoming banner/ringtone on INVITE.
  - NOT TESTED — Log Off (btnStop), History tab renders, History item dial+call, call timer start/stop.
- **Next safe step**:
  - Runtime/browser: verify the remaining untested items above; do not claim TASK-031 complete until they pass.

### 2026-04-12T02:23:00Z — TASK-031: desktop outbound-call-start boundary; desktopStartCall no longer imports shared outgoing/call/*
- **AI**: Cascade
- **Scope**: desktop-only outbound-call-start ownership (remote audio config, outbound diag context, inviter creation, LTE preflight). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCallSupport.js` (new)
  - `www/app/desktop/outgoing/desktopStartCallPreflight.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms `www/app/desktop/outgoing/desktopStartCall.js` has no `outgoing/call/*` imports).
- **Next safe step**:
  - Continue Step 5: isolate next highest-value shared/common module still used by active desktop runtime path (prefer `www/app/incoming/handlers/*`).

### 2026-04-12T02:07:00Z — TASK-031: desktop LTE relay readiness guard boundary; desktop no longer imports shared features/lteCallGuard.js
- **AI**: Cascade
- **Scope**: desktop-only LTE relay readiness guard ownership (outbound + inbound). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/desktopLteCallGuard.js` (new)
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `features/lteCallGuard.js` imports under `www/app/desktop`).
- **Next safe step**:
  - Continue Step 5: identify next highest-value shared/common import still used by active desktop runtime path (prefer outgoing/call/* or incoming/handlers/*).

### 2026-04-12T01:54:00Z — TASK-031: desktop conference join boundary; no longer imports shared conference/join.js
- **AI**: Cascade
- **Scope**: desktop-only conference join ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/conference/desktopJoinConference.js` (new - 164 lines)
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `conference/join.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports.

### 2026-04-12T01:48:00Z — TASK-031: desktop incoming state cleanup boundary; no longer imports shared incoming/handlers/state.js
- **AI**: Cascade
- **Scope**: desktop-only incoming state ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingState.js` (new)
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `incoming/handlers/state.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, etc.).

### 2026-04-12T01:42:00Z — TASK-031: desktop tab navigation boundary; no longer imports shared ui/tabNavigation.js
- **AI**: Cascade
- **Scope**: desktop-only tab navigation ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopTabNavigation.js` (new)
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `tabNavigation.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, incoming/handlers/state.js, etc.).

### 2026-04-12T01:35:00Z — TASK-031: desktop incoming call reject boundary; no longer imports shared sipCallIncoming.js
- **AI**: Cascade
- **Scope**: desktop-only incoming reject ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopRejectIncomingCall.js` (new)
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `sipCallIncoming.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: continue isolating remaining desktop shared imports (conference/join.js, ui/tabNavigation.js, incoming/handlers/state.js, etc.).

### 2026-04-12T01:24:00Z — TASK-031: desktop remote logging wrapper; bootstrap no longer directly imports shared remoteLogs.js
- **AI**: Cascade
- **Scope**: desktop-only remote logging wrapper ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/desktopRemoteLogs.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms bootstrapDesktopApp.js no longer directly imports shared remoteLogs.js).
- **Next safe step**:
  - TASK-031 Step 5: continue isolating remaining desktop shared imports or perform runtime verification.

### 2026-04-12T00:30:00Z — TASK-031: desktop session recovery boundary; desktop no longer imports shared push/recoverySession.js
- **AI**: Cascade
- **Scope**: desktop-only session recovery ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/desktopRecoverySession.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `recoverySession.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js) if needed.

### 2026-04-12T00:20:00Z — TASK-031: desktop logging/timestamps fully isolated; 12 desktop modules now use desktop-owned desktopLogging.js
- **AI**: Cascade
- **Scope**: desktop-only logging/timestamps ownership. No Android/iOS changes.
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
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection (grep confirms no remaining `config.js`/`log.js` imports in desktop path).
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js, push/recoverySession.js) if needed.

### 2026-04-12T00:10:00Z — TASK-031: desktop logging + timestamps boundary; desktop bootstrap no longer imports shared log.js or config.js
- **AI**: Cascade
- **Scope**: desktop-only logging/timestamps ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/desktopLogging.js` (new)
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/tasks/TASK-031.md`
  - `docs/now.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue Step 5: migrate remaining desktop shared imports (remoteLogs.js, push/recoverySession.js) if needed.

### 2026-04-11T18:46:00Z — TASK-031: desktop UI support boundary; desktop bootstrap no longer imports shared ui/historyActivity.js or ui/callTimer.js
- **AI**: Cascade
- **Scope**: desktop-only UI support module ownership (history + timer). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopUiSupport.js`
  - `www/app/desktop/ui/desktopUiSupportState.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: open desktop client, confirm History tab renders and dialing from History fills `#dial` and triggers Call; confirm timer still starts/stops on call establish/end.

### 2026-04-11T18:29:00Z — TASK-031: desktop outbound call start fix; read dialed destination from desktopDomRefs (pre-inviter bailout)
- **AI**: Cascade
- **Scope**: desktop-only outbound call start path. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place an outbound call and confirm SIP.js logs show an `INVITE` after `[ui] btnCall clicked...`.

### 2026-04-11T18:11:00Z — TASK-031: desktop UI shell isolation; desktopAppLayout no longer imports shared header/status/log layout sections
- **AI**: Cascade
- **Scope**: desktop-only UI shell sections ownership. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopShellSections.js`
  - `www/app/desktop/ui/desktopAppLayout.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client and confirm shell renders + controls still work; then continue isolating remaining shared UI module imports (appUi/historyActivity/callTimer/etc.) if required.

### 2026-04-11T17:56:00Z — TASK-031: verification-only session; runtime/browser proof not captured; docs updated to keep blocker truthful
- **AI**: Cascade
- **Scope**: docs/workflow only (no code changes).
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: perform the desktop reload + call tests and capture console evidence; then mark the boundary runtime-verified if it passes.

### 2026-04-11T17:52:00Z — TASK-031: desktop DOM boundary; desktop-owned DOM refs module for registration+dialpad+incoming-alert area
- **AI**: Cascade
- **Scope**: desktop-only DOM refs ownership; shared `www/app/dom.js` unchanged. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopDomRefs.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client and confirm registration, Log Off, incoming banner, and call controls still work; then identify next remaining shared import boundary in desktop tree.

### 2026-04-11T17:46:00Z — TASK-031: desktop UI/layout boundary; desktop bootstrap owns layout selection (remove desktop branching from shared bootstrapPage)
- **AI**: Cascade
- **Scope**: desktop-only layout selection ownership; shared bootstrap simplified (no desktop branching). No Android/iOS changes.
- **Files changed**:
  - `www/app/page/bootstrapPage.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client and confirm desktop renders via desktopAppLayout (registration+banner+dialpad) and that mobile renders unchanged.

### 2026-04-11T17:41:00Z — TASK-031: desktop UI/layout boundary; desktop-owned registration+dialpad layout + Log Off binds to btnStop
- **AI**: Cascade
- **Scope**: desktop-only layout/render + control binding fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopAppLayout.js`
  - `www/app/page/bootstrapPage.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: reload desktop client, confirm registration UI renders, Log Off works, and receiver banner shows on INVITE.

### 2026-04-11T17:33:00Z — TASK-031: desktop inbound ringing bugfix; add missing incoming alert banner DOM nodes
- **AI**: Cascade
- **Scope**: desktop-only incoming alert UI render support. No Android/iOS changes.
- **Files changed**:
  - `www/app/layout/dialpadSection.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: desktop→desktop call and confirm receiver banner shows on INVITE; then fix `btnStop` vs `btnLogout` wiring mismatch.

### 2026-04-11T17:16:00Z — TASK-031: desktop inbound ringing bugfix; reduce incoming alert suppression window (phantom-call guard)
- **AI**: Cascade
- **Scope**: desktop-only incoming alert UI guard fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingAlert.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: desktop→desktop call immediately after reload and confirm receiver banner/ringtone appear on INVITE.

### 2026-04-10T05:12:00Z — TASK-031: desktop inbound ringing bugfix; receiver now starts incoming alert/banner/ringtone on INVITE
- **AI**: Cascade
- **Scope**: desktop-only incoming alert wiring (receiver onInvite). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place desktop→desktop call and confirm receiver shows banner and plays ringtone on INVITE; then confirm alert stops on Answer/Reject.

### 2026-04-10T05:07:00Z — TASK-031: desktop outbound isolation; hangup button no longer imports shared ringback/platformAdapter via outgoing/call/hangupCall.js
- **AI**: Cascade
- **Scope**: desktop-only outbound hangup boundary. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopHangupCall.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and confirm nginx no longer serves `www/app/outgoing/ringback/index.js` or `www/app/runtime/shared/platformAdapter.js` due to hangup wiring.

### 2026-04-10T04:52:00Z — TASK-031: desktop outbound ringback bugfix; remove shared outgoing media/ringback imports from desktop call state-change path
- **AI**: Cascade
- **Scope**: desktop-only outbound ringback/media ownership boundary (stateChange). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundEstablished.js`
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `www/app/desktop/outgoing/desktopStartCall.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: place outbound call and confirm ringback starts on 180 and that shared modules `outgoing/media.js`, `ui/audioRoute/enforce.js`, `runtime/shared/platformAdapter.js`, `outgoing/ringback/index.js` are not loaded.

### 2026-04-10T04:37:00Z — TASK-031: desktop registration bugfix; normalize account input so ext is username (parse user@domain)
- **AI**: Cascade
- **Scope**: desktop-only registration normalization fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser verify: computed ext is username-only and `/ws` connect attempt + Kamailio register is observed.

### 2026-04-10T04:33:00Z — TASK-031: desktop registration bugfix; read ext/pass directly from DOM to prevent empty credentials on Enable Calls
- **AI**: Cascade
- **Scope**: desktop-only registration value-read fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser verify: click Enable Calls and confirm computed ext/passLen are non-empty and `/ws` connect attempt appears.

### 2026-04-10T04:17:00Z — TASK-031: desktop registration debug; add temporary [DESKTOP_REG_DEBUG] logs to locate pre-/ws stop point
- **AI**: Cascade
- **Scope**: desktop-only temporary debug logging in registration click path. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser: click Enable Calls and capture the first missing [DESKTOP_REG_DEBUG] log line; fix that exact stop point, then remove debug logs.

### 2026-04-10T04:05:00Z — TASK-031: desktop registration bugfix; refresh DOM cache in desktop bootstrap so Enable Calls handler attaches
- **AI**: Cascade
- **Scope**: desktop-only bootstrap/registration wiring fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser verify: click Enable Calls and confirm registration attempt starts (status/transport changes).

### 2026-04-10T03:57:00Z — TASK-031: desktop registration bugfix; Enable Calls button now triggers runOneTapEnableFlow (btnStart binding)
- **AI**: Cascade
- **Scope**: desktop-only registration UI binding fix. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Runtime/browser verify desktop registration attempt triggers after clicking Enable Calls.

### 2026-04-09T20:25:00Z — TASK-031 Step 5: desktop-owned incoming alert/ringtone end-to-end; desktop no longer imports incoming/alert.js (shared ringtone requires requirePlatformAdapter)
- **AI**: Cascade
- **Scope**: desktop-only incoming alert/ringtone boundary completion. No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue TASK-031 Step 5: audit remaining desktop imports for shared `requirePlatformAdapter()` / `getPlatformAdapter()` usage and move the next highest-value boundary to desktop-owned (behavior-preserving; do not change Android/iOS).

### 2026-04-09T20:10:00Z — TASK-031 Step 5: desktop-owned Established-state incoming handler; desktop no longer uses incoming/handlers/onEstablished.js (shared attachIncomingRemoteAudio)
- **AI**: Cascade
- **Scope**: desktop-only inbound Established-state handling + attach boundary (behavior-preserving). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingEstablished.js`
  - `www/app/desktop/incoming/desktopOnIncomingEstablished.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue TASK-031 Step 5: migrate desktop incoming alert/ringtone ownership off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

### 2026-04-09T19:45:00Z — TASK-031 Step 5: desktop-owned global audio-route enforcement; desktop call-controls no longer import shared ui/audioRoute/enforce.js (requirePlatformAdapter)
- **AI**: Cascade
- **Scope**: desktop-only UI audio-route enforcement boundary (behavior-preserving). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/ui/desktopCallControlAudioRoute.js`
  - `www/app/desktop/ui/desktopCallControls.js`
  - `www/app/desktop/ui/desktopCallControlsDtmf.js`
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue TASK-031 Step 5: migrate the shared Established-state incoming attach path off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

### 2026-04-09T19:25:00Z — TASK-031 Step 5: desktop-owned incoming attach-audio; desktop answer flow no longer uses shared attachIncomingRemoteAudio.js (requirePlatformAdapter)
- **AI**: Cascade
- **Scope**: desktop-only incoming attach-audio boundary (behavior-preserving). No Android/iOS changes.
- **Files changed**:
  - `www/app/desktop/incoming/desktopIncomingRemoteAudio.js`
  - `www/app/desktop/incoming/desktopIncomingRemoteAudioSupport.js`
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/now.md`
  - `docs/tasks/TASK-031.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (reload web app/desktop client).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Continue TASK-031 Step 5: migrate the global audio-route enforcement path off shared `requirePlatformAdapter()` onto a desktop-owned module/path (behavior-preserving; do not change Android/iOS).

