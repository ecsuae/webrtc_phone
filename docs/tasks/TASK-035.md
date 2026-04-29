# TASK-035 — Desktop dialer UI/runtime polish

## Title
Desktop dialer UI/runtime polish

## Status
Active

## Start date
2026-04-26

## End date
—

## Scope
- Desktop UI/runtime only.
- No backend/admin/provisioning/registration/SIP/media changes.
- No Android/iOS changes.
- Timezone normalization is a separate infra step.

## Current blocker
- Desktop dialer rendered the mobile-only keyboard icon/button.
- Physical keyboard digit entry could append twice when the dial input was focused because both the dial input keydown handler and the document capture keydown handler handled the same key.

## Exact next safe step
- Docker-only served asset verification, then browser/runtime confirmation that physical keyboard digits, delete/backspace, and on-screen dialpad clicks each apply once.

## Timestamped task history
- 2026-04-26 07:34 PKT | START  | TASK-035 | Desktop dialer polish: remove mobile keyboard icon and fix duplicate physical-key digit entry. | AI: Codex
- 2026-04-26 07:34 PKT | CHANGE | TASK-035 | Removed desktop-rendered `btnToggleKeyboard` markup and gated document-level desktop dialpad key handler when `#dial` is the event target. | AI: Codex
- 2026-04-26 07:34 PKT | VERIFY | TASK-035 | Docker-only: desktop page loads; served desktop dialer markup has no `btnToggleKeyboard`/`fa-keyboard`; served key handler returns false for `#dial`; no Android/iOS files touched. | AI: Codex
