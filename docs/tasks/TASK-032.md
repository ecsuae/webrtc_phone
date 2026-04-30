# TASK-032 — Desktop runtime/correctness

## Title
Desktop runtime/correctness

## Status
Active

## Start date
2026-04-13

## End date
—

## Scope
- Desktop runtime/correctness debugging only.
- No desktop isolation/refactor work.
- Keep changes minimal and evidence-driven.

## Goals
- Obtain runtime proof and fix the desktop outbound **extension-to-extension** early termination / reject path (477/480).
- Investigate and fix (or prove root cause of) **mic indicator stuck on** after hangup.
- Keep already-working behavior intact.

## Non-goals
- Do not reopen TASK-031 desktop isolation/refactor.
- Do not do broad refactors.
- Do not change SIP routing or server-side behavior.

## Current blocker
- Desktop feature-code/MOH calls still feel slow before audio starts.
- User logs show btnCall at 2026-04-26T01:41:36.503Z, mic granted at 01:41:36.919Z, dialing at 01:41:36.920Z, and INVITE/session establishing at 01:41:42.357Z (~5.4s pre-INVITE).
- SIP.js default ICE gathering timeout was reduced for desktop outbound calls only; user runtime test showed mic-grant to INVITE improved to about 2s.
- Remaining perceived delay appears post-answer/media-render, around Established/ICE connected/selected-pair/RTP/audio playback.
- Latest render diagnostics show play attempt/resolved and `audio-playing` before SIP Established, and first inbound RTP about 0.55s after Established; remaining evidence points toward early RTP silence or server/PBX content timing.

## Exact next safe step
- Runtime/browser call test for feature code/MOH: use `[desktop:audio-energy]` logs to determine whether early RTP has audio energy or silent packets.

## Timestamped task history
- 2026-04-13T05:15:00Z | START  | TASK-032 | Start state (runtime/correctness only; post-isolation). Blockers: ext-to-ext early termination (477/480), mic indicator stuck after hangup. Next: reproduce reliably, then add observability-only instrumentation. | AI: Cascade
- 2026-04-13 05:48 PKT | NOTE   | TASK-032 | Docs-only correction: updated `docs/tasks/Index.md` to set TASK-032 start date to 2026-04-13 based on change-ledger start-state timestamp. | AI: Cascade
- 2026-04-13 06:07 PKT | FIX    | TASK-032 | Desktop bootstrap unblock: removed stale import of deleted `www/app/desktop/outgoing/desktopOutboundSenderDiagnostics.js` from `desktopOutboundStateChange.js` and imported required functions directly from `www/app/desktop/outgoing/ext/` modules. | AI: Cascade
- 2026-04-13 06:09 PKT | FIX    | TASK-032 | Desktop bootstrap unblock: `desktopStartCallSupport.js` now exports `createDesktopInviter` (and `getDesktopOutboundDiagContext`) to satisfy `desktopExtInviteFlow.js` import and eliminate export-name runtime failure. | AI: Cascade
- 2026-04-13 06:14 PKT | FIX    | TASK-032 | Inbound stats loader unblock: `desktopIncomingPcStats.js` dynamic import path corrected from `../../pc/stats.js` (resolved to `/app/desktop/pc/stats.js` 404) to `../../../pc/stats.js` (real shared stats module). | AI: Cascade
- 2026-04-13 06:26 PKT | FIX    | TASK-032 | Desktop hard-refresh loop fix: consume one-shot hard-refresh state on boot by clearing `__desktop_hard_refresh_click_ts` and removing `hr=1` from the URL (via `history.replaceState`) in `desktopCacheHardRefreshSetup.js`, preventing a second reload during login typing. | AI: Cascade
- 2026-04-13 06:38 PKT | NOTE   | DOCS    | Workflow: set TASK-032 to Pending (runtime testing paused) and restore TASK-026 (Kamailio isolation/refactor) into current tracking as the active task. | AI: Cascade
- 2026-04-13 10:36 PKT | CHANGE | TASK-032 | Added decisive desktop outbound proof event `desktop-outbound-audio-proof` (post-established) to capture sender binding + transceiver direction + outbound RTP counters for ext-to-ext one-way audio triage. | AI: Cascade
- 2026-04-13 10:51 PKT | CHANGE | TASK-032 | Diagnostics parity: desktop outbound established calls now emit `receive-render-proof` at 5s/10s; media verdict synthesis classifies transport+RTP present but missing render-proof as `incomplete-observability` (diagnostics incomplete) instead of implying likely media failure. | AI: Cascade
- 2026-04-13 11:04 PKT | NOTE   | TASK-032 | Ext-to-ext call proven bidirectional-media OK (not a current one-way-media failure). Legs: outbound=3brgni4nkmug28ugh6mm; inbound=e0eeb614-b1a0-123f-5995-467af263c1d5. Proven: sender bound to local mic on outbound; RTP sent/received on both legs; receive/render proof on both legs. | AI: Cascade
 - 2026-04-13 11:20 PKT | CHANGE | TASK-032 | Inbound sender binding hardening: persist acquired mic track/stream ids on inbound answer; on inbound Established schedule `desktop-inbound-audio-proof` with sender binding + RTP/energy evidence and force audio sender to local stream audio track (replaceTrack) if needed (desktop-owned only). | AI: Cascade
- 2026-04-26 06:48 PKT | CHANGE | TASK-032 | Desktop outbound INVITE setup: set desktop-only outbound `iceGatheringTimeout` to 1500ms and added invite-call-start timing diagnostics around `inviter.invite()`; no backend/admin/provisioning/registration/mobile changes. | AI: Codex
- 2026-04-26 06:48 PKT | VERIFY | TASK-032 | Docker-only: desktop page loads; served outbound Inviter JS contains desktop-only 1500ms `iceGatheringTimeout`; served invite flow contains `desktop-invite-call-start` timing; registration UA has no ICE override; touched files under 200 lines. Runtime/browser call timing still pending. | AI: Codex
- 2026-04-26 06:56 PKT | CHANGE | TASK-032 | Desktop outbound media diagnostics: added render timing for remote track, audio src set, play attempt/resolved/rejected, audio element events, and first nonzero inbound RTP; no playback behavior changes. | AI: Codex
- 2026-04-26 06:56 PKT | VERIFY | TASK-032 | Docker-only: desktop page loads; served JS contains render timing diagnostics; served outgoing JS has no password/PIN logging matches; touched runtime files are under 200 lines. Runtime/browser call timing still pending. | AI: Codex
- 2026-04-26 07:07 PKT | CHANGE | TASK-032 | Desktop outbound render diagnostics now also emit obvious `[desktop:render-timing]` console/logLine entries from the same remote-audio bind path and include elapsed timing from `t_callStart`; no playback behavior changes. | AI: Codex
- 2026-04-26 07:07 PKT | VERIFY | TASK-032 | Docker-only: desktop page loads; served JS has `[desktop:render-timing]`; old `[outgoing:media] Remote ... bound` path imports/calls render helper; no password/PIN logging matches. Runtime/browser call timing still pending. | AI: Codex
- 2026-04-26 07:15 PKT | NOTE   | TASK-032 | User runtime logs show play attempt/resolved and `audio-playing` before Established; first inbound RTP arrives ~0.55s after Established, but audible music is still delayed. | AI: Codex
- 2026-04-26 07:15 PKT | CHANGE | TASK-032 | Added desktop outbound `[desktop:audio-energy]` diagnostics for inbound RTP packets/bytes, audioLevel, totalAudioEnergy, concealed samples, packets-with-zero-energy, and first nonzero energy; no playback/PBX behavior changes. | AI: Codex
- 2026-04-26 07:15 PKT | VERIFY | TASK-032 | Docker-only: desktop page loads; served JS has audio-energy labels/fields and render helper calls probe; no password/PIN logging matches. Runtime/browser audio-energy timing still pending. | AI: Codex
