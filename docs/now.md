# NOW

## Current task
TASK-034 — Desktop auto provisioning max_devices/logout runtime proof.

## Current blocker(s)
- Browser runtime evidence still must prove the real power/logout icon releases the active provisioning slot and clears visible PBX Username/Password.
- Docker/API verification now passes for active-slot logout and stale active TTL release.
- TASK-034 must not close until browser console logs and the admin Devices row confirm `active=false` after real browser logout.

## Exact next safe step
- User hard refreshes desktop, logs in via Autoconfigure ID/PIN, clicks the actual power/logout icon, and confirms the expected console logs plus admin Devices `active=false`.

## Why this matters
`max_devices` must mean active desktop auto-provision sessions, not stuck historical browser records.

## Task status (truthful)
- TASK-028: complete.
- TASK-029: pending.
- TASK-030: complete.
- TASK-031: complete/closed.
- TASK-032: pending; audio-delay work paused unless explicitly requested.
- TASK-033: pending.
- TASK-034: active; Docker/API fixed, awaiting browser runtime proof.
- TASK-035: active but paused while TASK-034 runtime proof is handled.
- TASK-036: complete.

## Scope guardrails
- Scope: desktop auto-provision logout/session handling and backend provisioning active-slot logic only.
- Do not touch admin Create account.
- Do not touch SIP/media/audio.
- Do not touch Android/iOS.
- Do not touch FusionPBX Phase B.
- Do not expose `sip_password`, `pin_hash`, or provisioning PIN in admin HTML/API responses.

## Already proven in this step
- Backend counts only same-account, non-revoked, `active === true` devices.
- Missing/non-boolean `active` remains normalized to `false`.
- `/api/provisioning/desktop/logout` is idempotent for existing devices and returns sanitized `active_after=false` proof.
- Active devices stale for more than 30 minutes are released and no longer block `max_devices`.
- Admin `Release Active` still releases without revoking/deleting.
- Current stale active device for provisioning account `51666785` was released by TTL recovery; active non-revoked count is now `0`.
- Served desktop JS contains the required logout click, stopAndUnregister, provisioning logout, and visible credential cleanup log paths.

## Browser proof still required
- Expected console lines after hard refresh + real power/logout click:
  - `[logout-click-runtime] actual power/logout clicked`
  - `[logout-runtime] stopAndUnregister entered silent=false`
  - `[auto-prov-logout] start provisioning_id_present=true device_id_present=true`
  - `[auto-prov-logout] fetch endpoint called yes`
  - `[auto-prov-logout] response status=200`
  - `[auto-prov-logout] backend active_after=false`
  - `[logout-runtime] visible credentials after cleanup ext_empty=true pass_empty=true`
