# TASK-037 — Provisioning cleanup portability + frozen production guardrails

## Title
Provisioning cleanup portability + frozen production guardrails

## Status
Active

## Start date
2026-04-30

## End date
—

## Scope
- Add a safe, portable, repo-owned way to release stale provisioning active slots.
- Ensure cleanup is safe against live Kamailio registrations.
- Ensure scheduled execution is deployment-first (docker-first) for new VM deployment.

## Non-goals
- Do not modify provisioning account data manually.
- Do not revoke or delete devices.
- Do not restart or change runtime behavior on frozen production unless explicitly approved.

## Current state (facts)
- A standalone cleanup script exists on the old production VPS (`phone.srve.cc`):
  - `scripts/release-stale-provisioning-slots.js`
- The old VPS currently uses host systemd to schedule it:
  - `/etc/systemd/system/webrtc-sbc-provisioning-cleanup.service`
  - `/etc/systemd/system/webrtc-sbc-provisioning-cleanup.timer`
- Those systemd units are not yet portable in-repo and must be replaced by a docker-first solution for new VM deployment.

## Verified behavior (facts)
- Cleanup dry-run proved it can skip registered extensions when Kamailio JSON-RPC shows the AoR present.
- Kamailio JSON-RPC `ul.dump location` confirmed `AoR: 100360` with WS `Received: sip:127.0.0.1:<port>;transport=ws`.

## Known risk discovered
- Immediately after Kamailio restart, usrloc may be empty until clients re-register.
- Cleanup must not release active slots during that restart window.

## Next safe step
- Make cleanup scheduling docker-first for new VM (`mobi.srve.cc`), e.g. a dedicated compose service or cron-like container.
- Ensure script is committed to git and backup artifacts are ignored.
