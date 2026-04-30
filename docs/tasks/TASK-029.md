# TASK-029 — Frontend: fix missing inbound raw proof rows in /admin/calllogs (runtime evidence)

## Task title
Frontend-only raw instrumentation follow-up: ensure required inbound proof rows actually appear in raw call logs for real merged-parent inbound calls.

## Scope and guardrails
- Scope: frontend webphone instrumentation only (`www/app/**`).
- Do not change:
  - push-server summary synthesis (already sufficient)
  - call routing, SIP signaling, or media behavior
  - routes/config/access control
- Raw logging remains additive only.

## Problem statement (runtime-confirmed)
For fresh merged-parent calls, raw logs show inbound events like:
- `remote-audio-attached`
- `call-established`
- `ice-complete`
- `media-stats-2s/5s/10s`
- `remote-audio-track-added`
- `remote-audio-ready-state`

…but still **do not show** these required inbound proof rows:
- `inbound-play-attempt`
- `inbound-play-resolved`
- `inbound-play-rejected`
- `inbound-audio-route-snapshot`
- `inbound-audio-element-state`
- inbound `receive-render-proof`
- inbound `remote-audio-play-ok`

## Required outcome / acceptance
After a frontend deploy + browser hard refresh, for a new inbound call the raw trace for the merged-parent corrId must include:
- at least one `inbound-play-attempt`
- one of `inbound-play-resolved` or `inbound-play-rejected` (as applicable)
- `inbound-audio-route-snapshot`
- `inbound-audio-element-state`
- inbound `remote-audio-play-ok` when playback actually occurs
- inbound `receive-render-proof` on the 5s/10s stats ticks when enabled

All must be tagged to the current merged-parent corrId/callId (no stale correlation).

## Notes / constraints discovered so far
- Some emit paths appear to be bypassed in real inbound calls even when other inbound milestones and stats are present.
- This task should start by determining which emit path is not executing at runtime and why (wiring vs gating vs event-type mapping vs transport).

## Next safe step
Instrument the frontend emit/transport path to prove whether the missing event types are:
- not emitted in-browser
- emitted but dropped/filtered before POST
- accepted but filtered from raw presentation

Do not modify summary synthesis as part of this task.
