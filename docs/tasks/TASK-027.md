# TASK-027 — RTPEngine isolation: migrate CLI-owned flags into repo config (split-brain reduction)

## Task title
RTPEngine isolation: reduce CLI-owned flags one at a time without changing runtime behavior.

## Scope and guardrails
- Scope: RTPEngine only.
- Do not touch Kamailio.
- Do not touch TASK-025 or TASK-026.
- Do not touch Android/iPhone/frontend.
- Isolation-first changes only.
- Remove/migrate **one** CLI-owned setting at a time (except coupled `port-min`/`port-max`).
- Prefer in-container runtime evidence over assumptions.

## Why it mattered
RTPEngine was running with split ownership between:
- CLI flags in `docker-compose.yml` (runtime overrides)
- image-owned `/etc/rtpengine.conf`

This created split-brain risk and made runtime behavior harder to reason about. The goal was to make repo-owned config authoritative, while proving behavior stability step-by-step.

## Protected behavior
- Wi-Fi ↔ Wi-Fi calling
- Kamailio ↔ RTPEngine integration
- Registration flow
- Push behavior

## Key mechanism (final architecture)
- Repo config: `rtpengine/rtpengine.conf`
- Mounted into container: `/config/rtpengine.conf` (read-only)
- Wrapper entrypoint: `rtpengine/entrypoint-wrapper.sh`
  - Copies `/config/rtpengine.conf` → `/etc/rtpengine.conf`
  - Then execs image `/entrypoint.sh`

This avoids the earlier failure mode where directly bind-mounting `/etc/rtpengine.conf:ro` broke startup because the image entrypoint edits `/etc/rtpengine.conf` using `sed -i`.

## Files involved
- `docker-compose.yml`
- `rtpengine/rtpengine.conf`
- `rtpengine/entrypoint-wrapper.sh`
- Workflow docs:
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`

## Step-by-step change history (safe isolated steps)

### Step 1 (attempt) — bind-mount `/etc/rtpengine.conf` (blocked)
- Summary:
  - Attempted `./rtpengine/rtpengine.conf:/etc/rtpengine.conf:ro`.
  - RTPEngine failed to start due to entrypoint `sed` rename failure on bind mount.
- Outcome:
  - Rolled back to restore service.
- Evidence (from `docs/session-log.md`):
  - `2026-04-06 09:08 PKT | CHANGE | TASK-027 | Tried mounting ./rtpengine/rtpengine.conf -> /etc/rtpengine.conf:ro; rtpengine exited (entrypoint sed rename failed on bind mount)`
  - `2026-04-06 09:09 PKT | CHANGE | TASK-027 | Rolled back /etc/rtpengine.conf bind mount to restore rtpengine service`

### Step 1 (final) — wrapper entrypoint to copy repo config into `/etc`
- Summary:
  - Added wrapper entrypoint to copy repo config into `/etc/rtpengine.conf` at startup.
  - Mounted `rtpengine/rtpengine.conf` to `/config/rtpengine.conf:ro`.
  - Kept existing CLI flags unchanged at this step.
- Evidence:
  - `2026-04-06 09:18 PKT | START  | TASK-027 | RTPEngine isolation step 1 (wrapper): mount repo config to /config and copy to /etc at startup`
  - `2026-04-06 09:19 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline unchanged; /etc/rtpengine.conf matches /config/rtpengine.conf; RTPEngine startup logs clean`

### Step 2 — move `log-level` ownership from CLI to config
- Summary:
  - Set `log-level = 7` in `rtpengine/rtpengine.conf`.
  - Removed `--log-level=7` from RTPEngine CLI args.
- Evidence:
  - `2026-04-06 09:28 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --log-level; /config and /etc both show log-level=7; startup logs clean`

### Step 3 — move `log-stderr` ownership from CLI to config
- Summary:
  - Removed `--log-stderr` from RTPEngine CLI args (config already had `log-stderr = true`).
- Evidence:
  - `2026-04-06 09:47 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --log-stderr; /config and /etc both show log-stderr=true; startup logs clean`

### Step 4 — confirm `foreground` is config-owned (verification-only)
- Summary:
  - Verified runtime already had no `--foreground` on the command line, and config had `foreground = true`.
- Evidence:
  - `2026-04-06 10:06 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --foreground; /config/rtpengine.conf and /etc/rtpengine.conf both show foreground = true`

### Alignment step — align config to live runtime values (no CLI removal)
- Summary:
  - Updated `rtpengine/rtpengine.conf` to match live runtime values for:
    - `listen-ng = 127.0.0.1:2223`
    - `port-min = 30000`
    - `port-max = 31000`
- Evidence:
  - `2026-04-06 10:19 PKT | VERIFY | TASK-027 | Verified /config and /etc contain aligned listen-ng/port-min/port-max after rtpengine restart; /proc/1/cmdline unchanged; logs show startup complete`

### Alignment step — align `interface` config to live runtime form (no CLI removal)
- Summary:
  - Updated `rtpengine/rtpengine.conf` interface to match the live runtime form (`eth0!<PUBLIC_IP>`).
- Evidence:
  - `2026-04-07 03:52 PKT | VERIFY | TASK-027 | Verified /config and /etc contain interface=eth0!38.242.157.239 after rtpengine restart; /proc/1/cmdline still includes --interface=eth0!38.242.157.239; logs show startup complete with no config parse error`

### CLI removal — remove `--listen-ng` (single-flag removal)
- Summary:
  - Removed `--listen-ng=127.0.0.1:2223` from RTPEngine CLI args.
- Evidence:
  - `2026-04-07 03:59 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --listen-ng ...; /config and /etc contain listen-ng=127.0.0.1:2223; logs show startup complete`

### CLI removal — remove `--interface` (single-flag removal)
- Summary:
  - Removed `--interface=eth0!${PUBLIC_IP}` from RTPEngine CLI args.
- Evidence:
  - `2026-04-07 04:09 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --interface and still has --port-min/--port-max; /config and /etc contain interface=eth0!38.242.157.239; logs show startup complete with no config parse error`

### CLI removal (final) — remove coupled `--port-min`/`--port-max`
- Summary:
  - Removed `--port-min=30000` and `--port-max=31000` together as a coupled pair.
- Evidence:
  - `2026-04-07 04:26 PKT | VERIFY | TASK-027 | Verified /proc/1/cmdline has no --port-min/--port-max; /config and /etc still contain port-min=30000 and port-max=31000; logs show startup complete with no config parse error`

## Verification history (runtime/container)
- In-container evidence expected after completion:
  - `/proc/1/cmdline` contains only `rtpengine --config-file /etc/rtpengine.conf` (no migrated CLI flags).
  - `/config/rtpengine.conf` matches `/etc/rtpengine.conf` for migrated keys.
  - Logs show clean startup.

### Independent re-check (verification-only)
- Evidence collected in-container:
  - `/proc/1/cmdline`: `rtpengine --config-file /etc/rtpengine.conf`
  - `/config/rtpengine.conf` and `/etc/rtpengine.conf` match for:
    - `log-level`, `log-stderr`, `foreground`, `listen-ng`, `interface`, `port-min`, `port-max`
  - Logs include `Startup complete` and no config parse errors were observed.

## Final outcome
- RTPEngine config ownership is repo-driven via wrapper copy.
- No remaining split ownership for the migrated items:
  - `log-level`
  - `log-stderr`
  - `foreground`
  - `listen-ng`
  - `interface`
  - `port-min`
  - `port-max`

## Completion note / next safe step
- TASK-027 complete.
- Do not remove additional RTPEngine flags under this task.
- Proceed only when a new task is explicitly selected.
