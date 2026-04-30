# NOW

## Current task
TASK-038 — Standalone plug-and-play deployment (mobi.srve.cc) — WireGuard + Let’s Encrypt.

## Current blocker(s)
- `https://mobi.srve.cc` loads but TLS is not trusted (cert automation missing).
- WireGuard container + env-driven settings must be implemented safely without exposing admin publicly.

## Exact next safe step
- Create and track TASK-038 docs.
- Prepare a minimal, reviewable WireGuard container step (env-driven) and wait for approval before starting containers.

## Why this matters
Make the new VPS deployment reproducible and safe: env-driven, docker-first, with automated TLS issuance/renewal and VPN-only admin access.

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
- TASK-037: active.

## Scope guardrails
- Work ONLY on the new VPS `mobi.srve.cc`.
- Old production VPS `phone.srve.cc` is frozen: no further runtime changes unless explicitly approved.
- Admin must not become publicly exposed; keep `ADMIN_BIND_HOST=127.0.0.1` until WireGuard is verified.

## Safety constraints (this session)
- Do not start containers.
- Do not restart services.
- Do not commit.

## Already proven (facts)
- Cleanup dry-run can skip Kamailio-registered SIP usernames when JSON-RPC `ul.dump location` shows the AoR present (example: 100360).
- Kamailio restart window can temporarily empty usrloc; cleanup must not release slots during that window.
