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
- TASK-035: `docs/tasks/TASK-035.md`
- TASK-036: `docs/tasks/TASK-036.md`
- TASK-034: `docs/tasks/TASK-034.md`

### Archives
- April 2026 archive (verbatim ledger snapshot): `docs/archive/change-ledger-2026-04.md`

### Recent activity pointers

- TASK-031 (desktop isolation/refactor): complete; full history: `docs/tasks/TASK-031.md`
- TASK-032 (desktop runtime/correctness): pending; audio-delay work paused after real-number IVR was heard properly.
- TASK-034 (desktop auto provisioning): active pending browser click-path confirmation; runtime logs and admin Release Active added.
- TASK-035 (desktop dialer UI/runtime polish): active; remove desktop-only mobile keyboard icon and duplicate key entry.
- TASK-036 (Docker timezone verification): complete; all active containers confirmed `Asia/Karachi` / `PKT`.
- TASK-037 (provisioning cleanup portability + frozen production guardrails): active; provisioning cleanup script exists on old VPS and must be made docker-first/portable for new VM.

## Current week entries

### 2026-04-30T09:22:00+05:00 — TASK-037: provisioning cleanup portability + frozen production guardrails
- **AI**: Cascade
- **Scope**: docs/workflow + repo hygiene for provisioning cleanup portability; no `.env` edits.
- **Files changed**:
  - `.gitignore`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-037.md`
- **Restart required**:
  - No
- **Verified result**:
  - Repo now ignores `scripts/*.bak-*` backup artifacts.
  - Workflow docs record: cleanup script exists on old production VPS; host systemd timer/service are not repo-portable; new VM work must be docker-first/repo-installable; old production is treated as frozen.
- **Next safe step**:
  - Commit `scripts/release-stale-provisioning-slots.js` (do not commit `.bak-*`), then implement docker-first scheduling for new VM deployment.

### 2026-04-26T10:20:00+05:00 — TASK-034: logout click-path proof + admin Release Active
- **AI**: Codex
- **Scope**: desktop logout runtime proof logs and admin active-slot recovery only; no SIP/media, Android/iOS, FusionPBX Phase B, manual login behavior, or historical device deletion changes.
- **Files changed**:
  - `www/app/desktop/ui/desktopShellSections.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `push-server/src/admin/provisioningPageDeviceRowScripts.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - `docker compose up -d --build push-server` completed; browser hard reload required for served JS.
- **Verified result**:
  - Docker-only: current stuck `51666785` active device released; served JS has `[logout-click-runtime]`, `[logout-runtime] stopAndUnregister entered`, `[auto-prov-logout] fetch endpoint called yes`, and visible cleanup log; API logout lets dev-b login with `max_devices=1`; admin Release Active sets active=false/revoked unchanged; admin HTML hides secrets.
- **Next safe step**:
  - User browser hard refresh and runtime console/admin confirmation; do not close TASK-034 until browser click path logs match.

### 2026-04-26T10:10:00+05:00 — TASK-034: runtime logout diagnostics and stuck-device release
- **AI**: Codex
- **Scope**: desktop auto-provision logout diagnostics/metadata robustness and Docker recovery for stuck active device only; no SIP/media, Android/iOS, FusionPBX Phase B, admin redesign, or manual login behavior changes.
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningSession.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No container restart required for served desktop JS; browser reload required. Docker recovery command released the stuck active device.
- **Verified result**:
  - Docker-only: current `51666785` stuck active device was released without deleting/revoking history; served JS contains `[auto-prov-logout]` diagnostics and logout endpoint path; API dev-a login/logout then dev-b login works with `max_devices=1`; admin HTML hides secrets and shows Active/logout timestamp.
- **Next safe step**:
  - User browser runtime confirmation with console logs; add admin Release Active button or heartbeat/TTL if crash/stale slots remain common.

### 2026-04-26T10:00:00+05:00 — TASK-034: active-slot release and logout privacy follow-up
- **AI**: Codex
- **Scope**: desktop auto-provision logout release/cleanup and provisioning device active-field normalization only; no SIP/media, Android/iOS, FusionPBX Phase B, admin redesign, or manual login behavior changes.
- **Files changed**:
  - `push-server/src/services/provisioning/provisionedDeviceNormalize.js`
  - `push-server/src/services/provisioning/provisionedDeviceStore.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - `docker compose up -d --build push-server` completed.
- **Verified result**:
  - Docker-only: old missing-active records normalize to `active:false`; two stale active real records were released without deleting history; `max_devices=1` login dev-a/block dev-b/logout dev-a/login dev-b/logout dev-b/login dev-a sequence passed; rebuild with inactive history did not block login; served desktop JS now calls `stopAndUnregister(false)` and contains logout endpoint/visible credential clear path.
- **Next safe step**:
  - Browser runtime confirmation for clean auto-provision logout; add heartbeat/TTL later if crash cleanup is required.

### 2026-04-26T08:49:00+05:00 — TASK-034: active-session max_devices correction
- **AI**: Codex
- **Scope**: provisioning active-session/device state and desktop auto-provision logout release only; no SIP/media, Android/iOS, FusionPBX Phase B, or manual login behavior changes.
- **Files changed**:
  - `push-server/src/services/provisioning/provisionedDeviceStore.js`
  - `push-server/src/services/provisioning/desktopProvisioningService.js`
  - `push-server/src/routes/provisioningRoutes.js`
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningSession.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningFlow.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/tasks/Index.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - `docker compose up -d --build push-server` completed.
- **Verified result**:
  - Docker-only: `max_devices=1` now counts active non-revoked devices only; `dev-a` logout released the slot so `dev-b` could login; revoke sets active false and revoked devices remain blocked; active/revoked/logout state persisted across rebuild; admin HTML hides secrets and shows Active/Login/Logout columns; served desktop JS calls `/api/provisioning/desktop/logout`.
- **Next safe step**:
  - Browser runtime confirmation for auto-provisioned logout release; add heartbeat/expiry later if crash cleanup is required.

### 2026-04-26T08:36:00+05:00 — TASK-034: provisioning persistence/admin display/logout privacy
- **AI**: Codex
- **Scope**: provisioning persistence/admin display plus desktop auto-provision logout privacy only; no SIP/media, Android/iOS, FusionPBX Phase B, or max-device semantic changes.
- **Files changed**:
  - `docker-compose.yml`
  - `.gitignore`
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningSession.js`
  - `www/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/tasks/Index.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - `docker compose up -d --build push-server` completed twice for mount activation and persistence verification.
- **Verified result**:
  - Docker-only: `/app/data/provisioning` is mounted from `./data/push-server/provisioning`; a seeded account/device/revoked state survived rebuild; admin HTML hides `sip_password`/`pin_hash`, shows SIP user column, and shortens long device IDs with full ID in attributes; served desktop JS contains auto-provision logout visible credential cleanup.
- **Next safe step**:
  - Browser runtime check for auto-provision logout privacy if user wants live UI confirmation.

### 2026-04-26T08:01:00+05:00 — TASK-034: provisioning max-device same-device bugfix
- **AI**: Codex
- **Scope**: desktop auto-provisioning identity + backend provisioning max-device error semantics only; no SIP/media, registration, Android/iOS, admin account create, or deprovision-on-logout changes.
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopAutoProvisioningStorage.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningFlow.js`
  - `push-server/src/services/provisioning/desktopProvisioningService.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/tasks/Index.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - `docker compose up -d --build push-server` completed.
- **Verified result**:
  - Docker-only: container syntax checks passed; seeded max_devices=1 account; `dev-a` succeeded twice; `dev-b` was blocked with `MAX_DEVICES_REACHED`; revoking `dev-a` let `dev-b` provision; admin HTML had no `sip_password`/`pin_hash`; desktop API had no `pin_hash`/`provisioning_pin` (Phase A still returns `config.sip_password` as required by desktop config apply).
- **Next safe step**:
  - Resume TASK-035 browser/runtime dialer confirmation when requested.

### 2026-04-26T07:57:00+05:00 — TASK-036: Docker timezone verification
- **AI**: Codex
- **Scope**: Docker/compose/timezone verification only; no source, desktop UI, SIP/media, backend/admin, provisioning, or feature changes.
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/TASK-036.md`
  - `docs/tasks/Index.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No restart/recreate required.
- **Verified result**:
  - Docker-only: active compose services are `coturn`, `rtpengine`, `kamailio`, `push-server`, `nginx`; rendered config has `TZ: Asia/Karachi` for all; running containers `coturn`, `kamailio`, `phone-nginx`, `push-server`, `rtpengine` all report `TZ=Asia/Karachi` and `date` in `PKT`.
- **Next safe step**:
  - Resume TASK-035 browser/runtime dialer confirmation when requested.

### 2026-04-26T07:34:00+05:00 — TASK-035: desktop dialer mobile icon + duplicate key entry
- **AI**: Codex
- **Scope**: desktop UI/runtime only; no backend, admin, provisioning, registration, SIP/media, Android, iOS, or timezone config changes.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopLayoutSections.js`
  - `www/app/desktop/ui/ext/desktopDialpadInputCore.js`
  - `docs/now.md`
  - `docs/tasks/TASK-035.md`
  - `docs/tasks/Index.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Browser reload for static served JS/HTML changes.
- **Verified result**:
  - Docker-only: desktop page loads; served desktop dialer markup has no `btnToggleKeyboard`/`fa-keyboard`/`keyboard-toggle-btn`; served desktop key handler returns false for `#dial`, leaving the input-owned handler as the only focused-input append path; no Android/iOS files touched; no credential logging added; touched files under 200 lines.
- **Next safe step**:
  - Verify desktop served markup/JS, then handle timezone normalization as a separate infra step.

### 2026-04-26T07:15:00+05:00 — TASK-032: desktop outbound RTP audio-energy diagnostics
- **AI**: Codex
- **Scope**: desktop outbound media diagnostics only; no playback, ICE, backend, admin, provisioning, registration, SIP routing, PBX config, Android, or iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/ext/desktopOutboundAudioEnergyProbe.js`
  - `www/app/desktop/outgoing/ext/desktopOutboundRenderTiming.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Browser reload for static served JS changes.
- **Verified result**:
  - Docker-only: desktop page loads; served JS contains `[desktop:audio-energy]`, `first-nonzero-energy`, `packets-with-zero-energy`, `inbound-rtp`, `audioLevel`, `totalAudioEnergy`, concealed sample fields, and render timing imports/calls the audio-energy probe; served outgoing/provisioning JS has no password/PIN logging matches; touched runtime files are under 200 lines.
- **Next safe step**:
  - Runtime call test with `[desktop:audio-energy]` logs; if RTP energy is unavailable/zero while packets arrive, inspect FreeSWITCH/PBX dialplan/content timing for `*9664`.

### 2026-04-26T07:07:00+05:00 — TASK-032: visible desktop outbound render timing logs
- **AI**: Codex
- **Scope**: desktop outbound media diagnostics only; no playback, backend, admin, provisioning, registration, SIP routing, Android, or iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/ext/desktopOutboundRenderTiming.js`
  - `www/app/desktop/outgoing/ext/desktopExtInviteFlow.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Browser reload for static served JS changes.
- **Verified result**:
  - Docker-only: desktop page loads; served JS contains `[desktop:render-timing]` strings and the existing `[outgoing:media] Remote ... bound` path imports/calls `observeDesktopOutboundRemoteAudio`; served outgoing/provisioning JS has no password/PIN logging matches; touched runtime files are under 200 lines.
- **Next safe step**:
  - Runtime call test for post-answer audio timing.

### 2026-04-26T06:56:00+05:00 — TASK-032: desktop outbound render timing diagnostics
- **AI**: Codex
- **Scope**: desktop outbound media diagnostics only; no backend, admin, provisioning, registration, SIP routing, Android, or iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/ext/desktopOutboundRenderTiming.js`
  - `www/app/desktop/outgoing/desktopOutgoingMedia.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Browser reload for static served JS changes.
- **Verified result**:
  - Docker-only: desktop page loads; served JS contains remote track/src/play/audio-element/first-RTP timing diagnostics; served outgoing JS has no password/PIN logging matches; touched runtime files are under 200 lines.
- **Next safe step**:
  - Runtime call test for post-answer audio timing.

### 2026-04-26T06:48:00+05:00 — TASK-032: desktop outbound pre-INVITE ICE wait
- **AI**: Codex
- **Scope**: desktop outbound media/runtime only; no backend, admin, provisioning, registration, SIP routing, Android, or iOS changes.
- **Files changed**:
  - `www/app/desktop/outgoing/ext/desktopExtInviterFactory.js`
  - `www/app/desktop/outgoing/ext/desktopExtInviteFlow.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No restart required for static served JS changes.
- **Verified result**:
  - Docker-only: desktop page loads; served outbound Inviter JS contains desktop-only 1500ms `iceGatheringTimeout`; served invite flow contains `desktop-invite-call-start` timing; registration UA has no ICE override; touched files are under 200 lines; no credential/PIN logging found in touched served JS.
- **Next safe step**:
  - Place a feature-code/MOH call in browser/runtime and compare click-to-INVITE timing.

### 2026-04-26T06:38:00+05:00 — TASK-034: Phase A logout UI polish
- **AI**: Codex
- **Scope**: desktop UI/runtime only; no backend, admin, provisioning API, SIP/media/call, Android, or iOS changes.
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/tasks/Index.md`
- **Restart required**:
  - No restart required for static served JS/HTML changes.
- **Verified result**:
  - Docker-only served asset checks: desktop page loads; logout binding calls `closeAutoProvisioningModal()`; logout path does not clear saved provisioning ID/PIN; saved-ID hint path exists.
- **Next safe step**:
  - Phase B only when explicitly requested, or browser/manual logout UX confirmation.

### 2026-04-26T04:42:00+05:00 — TASK-034: Phase A closeout/status verification
- **AI**: Codex
- **Scope**: docs/workflow only; no source, backend, desktop, admin, or runtime changes.
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/tasks/Index.md`
- **Restart required**:
  - No restart required.
- **Verified result**:
  - Code/docs inspection only: workflow docs checked against user-reported Phase A completion; no current Phase A blocker remains.
- **Next safe step**:
  - Start Phase B only when explicitly requested.

### 2026-04-25T04:58:00Z — TASK-034: Desktop UI/runtime — make Save checkbox visible; hide Forget unless saved
- **AI**: Cascade
- **Scope**: desktop provisioning creds UI only; no backend/admin changes; no provisioning API changes; no registration logic changes.
- **Problem**:
  - Global CSS (`www/styles/forms.css`) hides checkboxes (`input[type=checkbox]{display:none}`), making "Save ID & PIN" appear as plain text.
  - Forget button was always visible.
- **Fix**:
  - Render `chkSaveProvisioningCreds` as an explicitly visible checkbox (`display:inline-block; appearance:auto`) inside a clickable label row.
  - Hide Forget button by default and show it only when saved ID/PIN exists (localStorage keys `desktop_auto_provision_id` / `desktop_auto_provision_pin`).
  - After successful save, show Forget button; after Forget clears, hide it and uncheck Save.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/desktop/features/auto_provisioning/desktopAutoProvisioningStorage.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served `desktopRegistrationSection.js` contains `id="chkSaveProvisioningCreds" type="checkbox"` and Forget button defaults to `display:none`.
  - Served modal JS contains `setForgetVisible(...)` and uses `loadSavedAutoProvisioningCreds()` / `hasSavedAutoProvisioningCreds()` to toggle visibility.
  - Desktop page loads.

### 2026-04-25T04:50:00Z — TASK-034: Desktop runtime — remove stale Save ID & PIN status string (served asset fix)
- **AI**: Cascade
- **Scope**: desktop runtime message path only; no backend/admin changes; no provisioning API changes; no registration logic changes.
- **Fix**:
  - Removed the stale success status message "Save ID & PIN will be added later.".
  - When Save is checked and provisioning succeeds, success status now reads: "Auto provisioning complete. Registration started. ID & PIN saved on this device.".
  - Save is still performed before showing the saved-success status.
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` contains "ID & PIN saved on this device" and does not contain "Save ID & PIN will be added later".
  - Served modal JS includes `saveAutoProvisioningCreds({ id: provisioningId, pin })`.
  - Served storage JS includes keys `desktop_auto_provision_id` and `desktop_auto_provision_pin`.

### 2026-04-25T04:40:00Z — TASK-034: Desktop UI/runtime — explicit Autoconfigure textbox styling + Save ID & PIN localStorage
- **AI**: Cascade
- **Scope**: desktop UI/runtime only; no backend/provisioning API changes; no registration logic changes; no SIP/media changes; no Android/iOS changes.
- **Fix**:
  - Autoconfigure ID input now includes explicit textbox styling (border/radius/padding/font/background) to guarantee it renders as a real bordered input; placeholder set to `e.g. 78653467`.
  - Added dedicated classes `auto-config-row`, `auto-config-input`, `auto-config-button` and kept arrow button fixed width beside the input.
  - Implemented Phase A localStorage convenience: if `Save ID & PIN` is checked after successful provisioning+registration trigger, store the Provisioning ID and PIN in `localStorage` keys `desktop_auto_provision_id` + `desktop_auto_provision_pin`.
  - On page load, prefill saved Provisioning ID; when dialog opens, prefill saved PIN; added Forget button to clear saved values.
  - No SIP password is stored by this feature and the PIN is never logged.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningFlow.js`
  - `www/app/desktop/features/auto_provisioning/desktopAutoProvisioningStorage.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: `https://localhost/?mode=desktop` returns 200.
  - Served `desktopRegistrationSection.js` contains placeholder `e.g. 78653467` and explicit input style including `border: 2px solid var(--border-color)`.
  - Served `desktopAutoProvisioningStorage.js` contains `desktop_auto_provision_id` + `desktop_auto_provision_pin` and uses localStorage; modal JS itself does not write storage directly.
  - Manual login field IDs (`ext`, `pass`, `domain`, `wsshost`) are preserved.

### 2026-04-25T04:28:00Z — TASK-034: Desktop UI bugfix — Autoconfigure input styling match; Save checkbox no longer blocks login
- **AI**: Cascade
- **Scope**: desktop UI/runtime only; no backend/provisioning API changes; no registration logic changes; no Android/iOS changes.
- **Fix**:
  - Autoconfigure ID input now uses the same base `.form-group input` styling as Username (no inline input styling overriding border/height/padding).
  - Layout remains label-above with input and fixed-width arrow button side-by-side (no overlap).
  - PIN dialog Login no longer stops when `Save ID & PIN` is checked; the existing provisioning + injected `startAndRegister()` flow runs regardless.
  - After success (when checkbox was checked), shows a short note: "Save ID & PIN will be added later." (no storage implemented).
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served modal JS no longer contains "Saving ID & PIN is not implemented yet." and contains no `localStorage`/`sessionStorage` writes for provisioning creds.
  - Desktop page loads and Autoconfigure ID field renders as a normal `<input>` under `.form-group` with the same styling rules as Username.
  - Login still calls `runProvisioningFlow()` and then triggers injected `startAndRegister()`.

### 2026-04-25T04:09:00Z — TASK-034: Desktop UI bugfix — Autoconfigure ID row input/button layout corrected
- **AI**: Cascade
- **Scope**: desktop UI markup only; no backend/provisioning API changes; no registration logic changes.
- **Fix**:
  - Autoconfigure ID is now a normal writable `provisioningId` input (`type=text`, `inputmode=numeric`, `maxlength=8`).
  - Configure button `btnAutoProvisionStart` is fixed-width and shows a visible Unicode label (`➜`), not FontAwesome-only.
  - Flex layout + inline styles ensure the button is beside the input and does not overlap.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served HTML contains `auto-provision-row`, `provisioningId`, and `btnAutoProvisionStart` with `➜`.

### 2026-04-25T03:56:00Z — TASK-034: Desktop UI-only — integrated autoconfigure into login card; hide LTE/5G mode
- **AI**: Cascade
- **Scope**: desktop UI presentation only; reuse existing provisioning + registration logic; no backend changes.
- **UI changes**:
  - Removed separate Auto Provision button.
  - Added compact `Autoconfigure ID` input row with icon button (`Configure with ID`) that enables only when ID is present.
  - PIN is entered via a small centered dialog with `Login` / `Cancel`.
  - `Save ID & PIN` checkbox shows "not implemented" message only; does not store anything.
  - LTE/5G Mode control hidden on desktop.
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/page/bootstrapPage.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served desktop HTML includes Autoconfigure row + PIN dialog; `btnAutoProvisionOpen` absent; LTE/5G Mode not rendered; served JS binds enable/disable and does not store ID/PIN.

### 2026-04-25T03:26:00Z — TASK-034: Phase A fix — auto provisioning no longer overrides desktop WSS defaults
- **AI**: Cascade
- **Scope**: desktop provisioning adapter only; no backend/admin changes; no SIP/media/call logic changes.
- **Problem**:
  - Provisioning was writing `websocket_url` into desktop `wsshost`, forcing `wss://<domain>:7443/ws` which fails (WS close code 1006) and breaks previously working registration.
- **Fix**:
  - Auto provisioning now applies only `ext` + `password` + `domain`.
  - Adapter preserves the existing manual/default `wsshost` field value (does not overwrite from provisioning config).
  - Persisted last-registration uses the existing `wsshost` value.
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served JS has no `websocket_url` references in the adapter and does not overwrite `wsshost`.

### 2026-04-25T03:17:00Z — TASK-034: Desktop diagnostics — log real SIP.js UA ctor/start exceptions (no password)
- **AI**: Cascade
- **Scope**: desktop registration diagnostics only; no backend/admin changes; no media/call logic changes.
- **Behavior**:
  - Added safe logging of `ext/domain/wss/server` + `pass_set` immediately before SIP.js `new UserAgent(...)`.
  - On UA constructor failure and `ua.start()` failure, logs error `name`, `message`, and first stack line only.
  - Removed password-length logging; never logs password value.
- **Files changed**:
  - `www/app/desktop/registration/ext/desktopRegistrationUa.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served desktop JS contains new `[DESKTOP_REG_DEBUG] UA opts` and exception details; no password logging added.

### 2026-04-25T03:10:00Z — TASK-034: Desktop auto-provisioning fix — normalize/optional WSS host to avoid UA start failed
- **AI**: Cascade
- **Scope**: desktop provisioning adapter only; no backend/admin changes; no Android/iOS; no media/call logic changes.
- **Behavior**:
  - `websocket_url` is now optional in provisioned config for Phase A PBX flow.
  - If provided, provisioned websocket value is normalized to host:port (strip scheme/path) before writing to the desktop `wsshost` input.
  - If empty/missing, adapter does not overwrite the existing `wsshost` field.
  - Added safe diagnostics logging of applied `ext/domain/wsshost` only (never password).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: served desktop JS reflects normalization/empty handling; no password logging added; desktop page loads.

### 2026-04-25T02:39:00Z — TASK-034: Admin UI fix — Accounts table Account revoked reflects account state (not device revocations)
- **AI**: Cascade
- **Scope**: dashboard-only (admin provisioning UI); no backend logic changes; no storage/model changes; desktop unchanged.
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: disabled account rows show Account revoked=Yes; enabled account rows show Account revoked=No.
  - Docker-only: Devices table still has its own Revoked column for per-device revoke state.
  - Docker-only: HTML contains no `pin_hash` or `sip_password`.

### 2026-04-25T02:32:00Z — TASK-034: Admin UI fix — enabled checkbox label now shows enabled/revoked dynamically
- **AI**: Cascade
- **Scope**: dashboard-only (admin provisioning UI); no backend logic changes; no storage/model changes; desktop unchanged.
- **Files changed**:
  - `push-server/src/admin/provisioningPageParts.js`
  - `push-server/src/admin/provisioningPageAccountRowScripts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: `/admin/provisioning` renders enabled accounts with label `enabled` and disabled accounts with label `revoked`.
  - Docker-only: served JS contains `syncEnabledLabel` + DOMContentLoaded binder.
  - Docker-only: HTML contains no `pin_hash` or `sip_password`.

### 2026-04-25T02:14:00Z — TASK-034: Phase A store retrievable provisioning_pin (admin-only) + masked reveal UI
- **AI**: Cascade
- **Scope**: backend/storage/dashboard (admin provisioning only; desktop unchanged).
- **Security note**:
  - Intentionally stores a retrievable 4-digit PIN (`provisioning_pin`) for Phase A convenience.
  - Authentication continues to use `pin_hash` only.
  - Desktop API does not return `provisioning_pin`.
- **Files changed**:
  - `push-server/src/routes/adminProvisioningCreateAccountRoute.js`
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/services/provisioning/provisioningAccountStore.js`
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `push-server/src/admin/provisioningPageScripts.js`
  - `push-server/src/admin/provisioningPageAccountRowScripts.js`
  - `push-server/src/admin/provisioningPageDeviceRowScripts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/now.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: accounts JSON contains both `pin_hash` and `provisioning_pin` after create/reset-pin.
  - Docker-only: `/admin/provisioning` shows masked PIN by default with reveal/hide toggle.
  - Docker-only: admin HTML contains no `pin_hash`/`sip_password` and no `read-only`.
  - Docker-only: desktop `/api/provisioning/desktop` responses contain no `provisioning_pin`/`pin_hash`/`sip_password`.
- **Next safe step**:
  - Decide whether to keep `provisioning_pin` beyond Phase A; if keeping, consider at-rest encryption and retention/rotation policies.

### 2026-04-25T02:07:00Z — TASK-034: Admin provisioning management (Phase A): edit/delete/reset PIN UX + disabled display
- **AI**: Cascade
- **Scope**: backend/storage/dashboard (admin provisioning only; no desktop changes; no FusionPBX).
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `push-server/src/admin/provisioningPageScripts.js`
  - `push-server/src/admin/provisioningPageCreateScripts.js`
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/routes/adminProvisioningAccountManagementRoutes.js`
  - `push-server/src/services/provisioning/provisioningAccountStore.js`
  - `push-server/src/services/provisioning/provisionedDeviceStore.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: `/admin/provisioning` returns 200, shows `manual Phase A` badge, and includes Edit/Delete/Generate New PIN controls.
  - Docker-only: HTML contains no `pin_hash` or `sip_password` strings.
  - Docker-only: POST update accepts non-secret fields; enabled=false displays `Disabled / Revoked` after reload.
  - Docker-only: POST delete removes account and associated devices.
- **Next safe step**:
  - Decide whether to add separate SIP password change UI (still keep secret hidden) or defer; then do desktop end-to-end provisioning manual test.

### 2026-04-25T01:58:00Z — TASK-034: Workflow sync — update now.md after pepper + admin create success
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Implement admin provisioning account management improvements (delete endpoint + reset PIN UX + disabled/revoked display) as a single isolated safe step.

### 2026-04-25T01:51:00Z — TASK-034: Local config — set PROVISIONING_PIN_PEPPER in .env
- **AI**: Cascade
- **Scope**: local infra/service config only (no code changes).
- **Files changed**:
  - `.env`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: `docker compose up -d --build push-server` and container has non-empty `PROVISIONING_PIN_PEPPER`.
  - Docker-only: admin create provisioning account returns 201 (no SERVER_MISCONFIGURED).
- **Notes**:
  - Pepper value is a generated long random secret; do not share/commit a production value.

### 2026-04-25T01:49:00Z — TASK-034: Infra — document PROVISIONING_PIN_PEPPER for Docker plug-and-play
- **AI**: Cascade
- **Scope**: infra/config only (no runtime behavior changes).
- **Files changed**:
  - `.env.example`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Verified result**:
  - Docker-only: compose passes `PROVISIONING_PIN_PEPPER` into push-server when set.
  - Docker-only: with `PROVISIONING_PIN_PEPPER=test-pepper docker compose up -d --build push-server`, admin create returns 201 and response JSON contains no `sip_password`/`pin_hash`.
  - Docker-only: without pepper, admin create returns SERVER_MISCONFIGURED 500.
- **Next safe step**:
  - Put a long random value in `.env` `PROVISIONING_PIN_PEPPER`, restart push-server, then do end-to-end admin create + duplicate-id checks.

### 2026-04-25T01:42:00Z — TASK-034: Admin provisioning — WebSocket URL auto-fill in create form
- **AI**: Cascade
- **Scope**: admin create form only (WebSocket URL auto-fill from SIP domain; no backend changes; no FusionPBX; no desktop changes).
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageCreateScripts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: `/admin/provisioning` includes WebSocket Auto-fill button; served JS includes `autoFillWebsocketUrlFromDomain()` and centralized template for `wss://<sip_domain>:7443`.
  - Docker-only: create payload still uses `sip_password`; HTML contains no `pin_hash`.

### 2026-04-25T01:36:00Z — TASK-034: Admin provisioning — create form fixes (PIN toggle + sip_password key)
- **AI**: Cascade
- **Scope**: admin create form only (PIN show/hide; create submit uses `sip_password`; no FusionPBX; no desktop changes).
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageScripts.js`
  - `push-server/src/admin/provisioningPageCreateScripts.js`
  - `push-server/src/routes/adminProvisioningCreateAccountRoute.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: `/admin/provisioning` returns 200 and contains create PIN toggle button + `toggleCreatePin()`.
  - Docker-only: served JS uses `sip_password` (not `sip_pass`).
  - Docker-only: create route returns SERVER_MISCONFIGURED when pepper missing; response JSON contains no `sip_password`/`pin_hash`.
- **Next safe step**:
  - Set `PROVISIONING_PIN_PEPPER` and verify create succeeds + duplicate provisioning_id rejection + created account appears in table (no secrets rendered).

### 2026-04-25T01:25:00Z — TASK-034: Admin provisioning — create account flow (Phase A manual)
- **AI**: Cascade
- **Scope**: backend/admin provisioning only (manual account creation; no FusionPBX; no desktop changes).
- **Files changed**:
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageScripts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/now.md`
- **Restart required**:
  - Yes (push-server): `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: `http://localhost:3001/admin/provisioning` returns 200 and includes create form + Generate buttons.
  - Docker-only: HTML contains no `sip_password` or `pin_hash` strings.
  - Docker-only: create endpoint returns 400 for invalid provisioning ID/PIN and returns SERVER_MISCONFIGURED 500 when `PROVISIONING_PIN_PEPPER` is unset.
- **Next safe step**:
  - Set `PROVISIONING_PIN_PEPPER` and verify create succeeds + duplicate provisioning_id is rejected + response JSON remains sanitized.

### 2026-04-25T01:13:00Z — TASK-034: Desktop runtime — trigger startAndRegister after provisioning
- **AI**: Cascade
- **Scope**: desktop-only auto provisioning (after config apply, trigger registration via injected `startAndRegister`; no Provisioning ID/PIN storage; no registration engine changes).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/runtime/desktop/callFlowDesktop.js`
  - `www/app/desktop/bootstrapDesktopApp.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/now.md`
- **Restart required**:
  - No
- **Verified result**:
  - Docker-only: `https://localhost/?mode=desktop` returns 200.
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` references `startAndRegister` only via injected param + local wrapper and contains no `localStorage`/`sessionStorage` usage.
  - Docker-only: served modal JS still imports provisioning client + settings adapter.
  - Docker-only: POST `/api/provisioning/desktop` still returns JSON.
- **Next safe step**:
  - Desktop-only: manual end-to-end test of Auto Provision Configure applying config and starting registration (do not save Provisioning ID/PIN yet).

### 2026-04-25T01:07:00Z — TASK-034: Desktop runtime — wire Auto Provision Configure to call API + apply config
- **AI**: Cascade
- **Scope**: platform-specific runtime (desktop only; wire modal Configure click; no registration trigger; no Provisioning ID/PIN storage).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/now.md`
- **Restart required**:
  - No
- **Verified result**:
  - Docker-only: desktop page loads (HTTP 200 for `https://localhost/?mode=desktop`).
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` includes imports for `desktopProvisioningClient.js` and `applyProvisionedConfigToDesktopInputs.js`.
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` does not reference `registration.startAndRegister`.
  - Docker-only: POST `/api/provisioning/desktop` still returns JSON.
- **Next safe step**:
  - Desktop-only: perform end-to-end UI test of Auto Provision Configure filling desktop inputs (no registration trigger; do not save Provisioning ID/PIN yet).

### 2026-04-25T00:10:00Z — TASK-034: Desktop runtime — isolated settings-write adapter
- **AI**: Cascade
- **Scope**: platform-specific runtime (adapter module only; not wired into UI; no registration trigger).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Docker-only: served `/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js` contains export `applyProvisionedConfigToDesktopInputs` and does not reference `registration.startAndRegister`.
- **Next safe step**:
  - Desktop-only: wire modal Configure click to call API client + apply settings adapter (no registration trigger yet).

### 2026-04-25T00:05:00Z — TASK-034: Desktop runtime — isolated provisioning API client module
- **AI**: Cascade
- **Scope**: platform-specific runtime (desktop client module only; not wired into UI).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningClient.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningClient.js` contains `/api/provisioning/desktop` and export `requestDesktopProvisioning`.
- **Next safe step**:
  - Desktop-only: add isolated settings write adapter (no registration trigger).

### 2026-04-25T00:00:00Z — TASK-034: Desktop UI-only — Auto Provision modal bindings
- **AI**: Cascade
- **Scope**: desktop UI only (show/hide modal; Configure shows local not-wired status only).
- **Files changed**:
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Docker-only: `/?mode=desktop` loads.
  - Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` contains `bindDesktopAutoProvisioningModalHandlers`.
- **Next safe step**:
  - Desktop UI only: add an isolated provisioning API client module (no settings write; no registration trigger).

### 2026-04-24T23:55:00Z — TASK-034: Desktop UI-only — Auto Provision button + modal skeleton
- **AI**: Cascade
- **Scope**: desktop UI only (markup skeleton; no API call; no storage; no registration trigger).
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Live route (container): desktop page loads (HTTP 200 for `/?mode=desktop`).
  - Live route (container): served module `/app/desktop/ui/ext/desktopRegistrationSection.js` contains `btnAutoProvisionOpen` + modal skeleton IDs and preserves manual field IDs (`ext`, `pass`, `domain`, `wsshost`).
- **Next safe step**:
  - Desktop UI only: add show/hide bindings for the modal (no API call, no storage writes).

### 2026-04-24T23:50:30Z — TASK-034: UI-only split — desktop registration section
- **AI**: Cascade
- **Scope**: UI-only refactor/split (no backend changes; no registration logic changes).
- **Files changed**:
  - `www/app/desktop/ui/ext/desktopLayoutSections.js`
  - `www/app/desktop/ui/ext/desktopRegistrationSection.js`
  - `docs/tasks/TASK-034.md`
- **Restart required**:
  - No
- **Verified result**:
  - Live route (container): desktop page loads (HTTP 200 for `/?mode=desktop`).
- **Next safe step**:
  - Add desktop Auto Provision button/modal skeleton inside the desktop registration section (UI only; no API/settings/registration trigger).

### 2026-04-24T23:50:00Z — TASK-034: docs — Docker-only backend API seed + test procedure
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only: documented procedure matches current `/api/provisioning/desktop` route/service contracts and uses Docker/container-only commands with dummy SIP credentials.
- **Next safe step**:
  - Implement desktop auto provisioning UI (desktop-only).

### 2026-04-24T23:45:00Z — TASK-034: UI-only split — provisioning page parts/scripts
- **AI**: Cascade
- **Scope**: UI-only refactor/split (no route changes; no new admin features).
- **Files changed**:
  - `push-server/src/admin/provisioningPageParts.js`
  - `push-server/src/admin/provisioningPageScripts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: syntax checks pass; live GET `/admin/provisioning` returns 200; expected action strings still present; HTML contains no `sip_password` or `pin_hash`.
- **Next safe step**:
  - Add SIP password change UI (admin provisioning page) using the new scripts module while keeping secrets hidden.

### 2026-04-24T23:40:00Z — TASK-034: admin SIP password change endpoint (backend only)
- **AI**: Cascade
- **Scope**: backend route only (no UI).
- **Files changed**:
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: POST `/admin/provisioning/account/change-sip-password` validates `sip_password` length>=6, updates `sip_password` only, and returns sanitized account JSON (no `sip_password`/`pin_hash`); `/admin/provisioning` HTML contains no `sip_password` or `pin_hash`.
- **Next safe step**:
  - Implement desktop auto provisioning UI (desktop-only) and keep backend/admin provisioning controls stable.

### 2026-04-24T23:35:00Z — TASK-034: admin PIN reset control
- **AI**: Cascade
- **Scope**: admin PIN reset control only (no SIP password changes; no account creation).
- **Files changed**:
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `docker-compose.yml`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: POST `/admin/provisioning/account/reset-pin` validates numeric PIN length>=4, requires `PROVISIONING_PIN_PEPPER` (500 SERVER_MISCONFIGURED when missing), updates `pin_hash` only, and returns sanitized account JSON; `/admin/provisioning` HTML contains no `sip_password` or `pin_hash`.
- **Next safe step**:
  - Implement desktop auto provisioning UI (desktop-only) and keep backend/admin provisioning controls stable.

### 2026-04-24T23:25:00Z — TASK-034: route split — adminRoutes.js into attach modules
- **AI**: Cascade
- **Scope**: route refactor/split only (no behavior changes; no new admin features).
- **Files changed**:
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/routes/adminRoutingRoutes.js`
  - `push-server/src/routes/adminCallLogsRoutes.js`
  - `push-server/src/routes/adminCallLogsExportRoutes.js`
  - `push-server/src/routes/adminRegistrationsRoutes.js`
  - `push-server/src/routes/adminProvisioningRoutes.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: syntax checks pass for all new route modules; live GET `/admin/routing`, `/admin/calllogs`, `/admin/registrations`, `/admin/provisioning` return 200; provisioning update+revoke endpoints still return sanitized JSON; `/admin/provisioning` HTML contains no `sip_password` or `pin_hash`.
- **Next safe step**:
  - Implement PIN reset (WireGuard-only) with strict sanitization + container-only verification.

### 2026-04-24T23:15:00Z — TASK-034: UI-only split — provisioning admin page
- **AI**: Cascade
- **Scope**: UI-only refactor/split of provisioning admin page (no route changes).
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/admin/provisioningPageParts.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: Node syntax checks pass for both modules; live GET `/admin/provisioning` returns 200; HTML does not contain `sip_password` or `pin_hash`; existing update/revoke controls still present.
- **Next safe step**:
  - Implement PIN reset (WireGuard-only) with strict sanitization + container-only verification.

### 2026-04-24T23:05:00Z — TASK-034: admin device revoke/unrevoke control
- **AI**: Cascade
- **Scope**: backend/admin device revoke/unrevoke only.
- **Files changed**:
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/admin/provisioningPage.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: POST `/admin/provisioning/device/revoke` accepts `{provisioning_id, device_id, revoked}` and returns sanitized `device` JSON; `/admin/provisioning` renders devices table with revoke/unrevoke action and does not include `sip_password` or `pin_hash`.
- **Next safe step**:
  - Implement PIN reset (WireGuard-only) with strict response sanitization and container-only verification.

### 2026-04-24T22:48:00Z — TASK-034: correction — Docker-only verification required
- **AI**: Cascade
- **Scope**: docs/workflow correction only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Policy-only: TASK-034 verification/runtime commands are Docker/container-only; earlier host Node syntax/import checks are superseded going forward.
- **Next safe step**:
  - Use `docker compose exec push-server node -c <file>` and container-exposed HTTP routes for all checks.

### 2026-04-24T22:44:00Z — TASK-034: container-only verification rule + admin response sanitizer
- **AI**: Cascade
- **Scope**: workflow hardening + security bug fix only.
- **Files changed**:
  - `push-server/src/routes/adminRoutes.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Docker-only: POST `/admin/provisioning/account/update` response JSON does not include `sip_password` or `pin_hash`; `/admin/provisioning` HTML remains free of both strings.
- **Next safe step**:
  - Continue admin provisioning controls (PIN reset / device revoke) only after security review of responses.

### 2026-04-24T22:39:00Z — TASK-034: minimal admin write controls (account flags only)
- **AI**: Cascade
- **Scope**: admin write controls limited to existing accounts (enabled/auto/max_devices).
- **Files changed**:
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/admin/provisioningPage.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Live route (container): POST `/admin/provisioning/account/update` returns `{ok:true}` for seeded account; `/admin/provisioning` HTML does not include `sip_password` or `pin_hash`.
- **Next safe step**:
  - Add admin create-account + PIN reset + device revoke controls (WireGuard-only), keeping SIP password hidden.

### 2026-04-24T22:34:00Z — TASK-034: read-only admin provisioning page
- **AI**: Cascade
- **Scope**: admin read-only page only (no write actions).
- **Files changed**:
  - `push-server/src/admin/provisioningPage.js`
  - `push-server/src/routes/adminRoutes.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Live route (container): `/admin/provisioning` returns HTTP 200 and HTML does not include `sip_password` or `pin_hash`.
- **Next safe step**:
  - Add WireGuard-only admin write controls for provisioning accounts/devices (minimal POST endpoints + input validation).

### 2026-04-24T22:30:00Z — TASK-034: mount provisioning API route
- **AI**: Cascade
- **Scope**: minimal shared edit (mount `/api/provisioning` only; no admin UI).
- **Files changed**:
  - `push-server/server.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Live route (container): `POST /api/provisioning/desktop` returns structured JSON error (SERVER_MISCONFIGURED 500) with no stack trace.
- **Next safe step**:
  - Add WireGuard-only admin controls for provisioning accounts/devices.

### 2026-04-24T22:29:00Z — TASK-034: docs correction (record provisioning route module details)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Mount `/api/provisioning` in `push-server/server.js` (minimal shared edit) and verify live route behavior.

### 2026-04-24T22:26:00Z — TASK-034: provisioning API route module (not mounted)
- **AI**: Cascade
- **Scope**: backend route module only (no server.js mount; no admin UI).
- **Files changed**:
  - `push-server/src/routes/provisioningRoutes.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Host require check succeeded; router factory returns an Express router.
- **Next safe step**:
  - Mount `/api/provisioning` in `push-server/server.js` (minimal shared edit) and add a live route verification.

### 2026-04-24T22:24:00Z — TASK-034: harden provisioning service (require PROVISIONING_PIN_PEPPER)
- **AI**: Cascade
- **Scope**: backend service hardening only (no routes mounted; no admin UI).
- **Files changed**:
  - `push-server/src/services/provisioning/desktopProvisioningService.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Host smoke tests: missing pepper returns `SERVER_MISCONFIGURED` (500); pepper set still provisions successfully.
- **Next safe step**:
  - Implement `/api/provisioning/desktop` route module and mount `/api/provisioning` in `push-server/server.js` (minimal shared edit).

### 2026-04-24T22:22:00Z — TASK-034: provisioning service layer (no route mounts)
- **AI**: Cascade
- **Scope**: backend service-only (no routes mounted; no admin UI).
- **Files changed**:
  - `push-server/src/services/provisioning/desktopProvisioningService.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Host Node require check succeeded; smoke test verified success + device-limit + invalid-credentials.
- **Next safe step**:
  - Add `/api/provisioning/desktop` route module and mount it in `push-server/server.js` (minimal shared edit), keeping admin UI deferred.

### 2026-04-24T22:19:00Z — TASK-034: storage-only provisioning stores (push-server)
- **AI**: Cascade
- **Scope**: backend storage-only (no routes mounted; no admin UI).
- **Files changed**:
  - `push-server/src/services/provisioning/provisioningPaths.js`
  - `push-server/src/services/provisioning/provisioningAccountStore.js`
  - `push-server/src/services/provisioning/provisionedDeviceStore.js`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Host Node require check succeeded for new modules.
- **Next safe step**:
  - Implement provisioning service logic (validation + device limit enforcement) without mounting routes yet.

### 2026-04-24T22:17:00Z — TASK-034: docs update (record route/admin integration patterns)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Implement backend provisioning account/device stores (storage-only; no route mounts yet).

### 2026-04-24T22:15:00Z — TASK-034: docs update (record inspected backend/admin boundaries)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Inspect route mount/admin route patterns only (inspection only; no edits) to plan the smallest route integration step.

### 2026-04-24T22:12:00Z — TASK-034: docs update (record inspected desktop boundaries)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Inspect backend/admin structure for provisioning model/route/admin location (inspection only; no edits).

### 2026-04-24T22:09:00Z — TASK-034: docs correction (record start date)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Inspect desktop settings storage + registration trigger boundary (no edits) before implementing desktop auto provisioning UI.

### 2026-04-24T22:05:00Z — TASK-034: docs/workflow staging (desktop auto provisioning)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Files changed**:
  - `docs/tasks/TASK-034.md`
  - `docs/now.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
  - `docs/tasks/Index.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only (docs-only step).
- **Next safe step**:
  - Inspect desktop settings storage + registration trigger boundary to design a single safe adapter for writing provisioned config.

### 2026-04-13T20:52:00Z — TASK-033: PBX DNS column prefers hostname over IP when present
- **AI**: Cascade
- **Scope**: admin registrations page renderer only (read-only).
- **Change**:
  - Updated PBX DNS/domain resolver to prefer hostname candidates (pbxDnsName → pbxDomain → AOR host if not IP → other hostname fields) and only fall back to IP when no hostname exists; else `Unknown`.
- **Files changed**:
  - `push-server/src/admin/registrationsPage.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - Live route (container): `/admin/registrations` returns HTTP 200 and PBX DNS selection no longer chooses non-domain labels.
- **Next safe step**:
  - Confirm in the target environment that rows with an available hostname (e.g. `fusn02.srve.cc`) render that hostname instead of the IP.

### 2026-04-13T06:20:00Z — TASK-032: inbound sender-binding proof + sender-track force (desktop inbound)
- **AI**: Cascade
- **Scope**: desktop inbound diagnostics + sender binding hardening only (no SIP/Kamailio/PBX changes).
- **Change**:
  - Persist acquired mic track/stream ids on inbound answer for later comparison.
  - On inbound Established, emit `desktop-inbound-audio-proof` at ~2.5s and ~10s with sender vs acquired mic ids, transceiver direction/currentDirection, outbound RTP counters, and sender energy when available.
  - If sender track is not bound to the acquired local mic track, force it via `replaceTrack` to the local stream audio track (desktop-owned only).
- **Files changed**:
  - `www/app/desktop/incoming/desktopAnswerIncomingCall.js`
  - `www/app/desktop/incoming/desktopOnIncomingEstablished.js`
  - `www/app/desktop/incoming/ext/desktopInboundSenderProof.js`
  - `docs/now.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No (frontend/runtime change; requires browser reload to pick up).
- **Verified result**:
  - Code inspection only.
- **Next safe step**:
  - Reproduce the failing ext-to-ext call and confirm `desktop-inbound-audio-proof` shows senderTrackId == acquiredLocalMicTrackId; if bound but energy stays near-zero while speaking, treat as silent-source/capture issue.

### 2026-04-13T06:04:00Z — TASK-032: record bidirectional-media proven ext-to-ext call (docs-only)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Change**:
  - Recorded a verified ext-to-ext call as bidirectional-media proven (not a current one-way-audio failure).
- **Files changed**:
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No
- **Verified result**:
  - Code inspection only (docs updated to reflect provided runtime proof).
- **Next safe step**:
  - Audit admin verdict/anomaly synthesis naming so bidirectional proof classifies as OK (see TASK-032 notes).

### 2026-04-13T05:51:00Z — TASK-032: outbound receive/render proof parity + observability verdict
- **AI**: Cascade
- **Scope**: diagnostics parity only (no SIP/PBX behavior changes).
- **Change**:
  - Desktop outbound established calls now emit `receive-render-proof` at 5s and 10s (remote audio element state, receiver track state, RTP counters, energy, codec).
  - Media verdict synthesis now classifies transport+RTP present but missing render-proof as `incomplete-observability` (diagnostics incomplete) instead of implying likely media failure.
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundEstablished.js`
  - `push-server/src/admin/callLogMediaVerdictSynthesis.js`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: rebuild/restart push-server to apply verdict synthesis change.
  - Frontend: browser reload required to pick up desktop JS changes.
- **Next safe step**:
  - Run one ext-to-ext test call and confirm both legs show comparable `receive-render-proof` rows; verify verdict moves from `asymmetric-media-proof` to either `two-way-audio-proven` or `incomplete-observability`.

### 2026-04-13T05:36:00Z — TASK-032: add desktop outbound one-way-audio proof event
- **AI**: Cascade
- **Scope**: desktop runtime diagnostics only (no behavior change intended).
- **Change**:
  - Added `desktop-outbound-audio-proof` event emitted ~2.5s after Established to capture:
    - sender track id vs local mic track id
    - track enabled/muted/readyState
    - transceiver direction/currentDirection
    - outbound RTP packets/bytes/audioLevel
- **Files changed**:
  - `www/app/desktop/outgoing/desktopOutboundStateChange.js`
  - `docs/now.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-032.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - No (frontend/runtime change; requires browser reload to pick up).
- **Verified result**:
  - Code inspection: proof event is scheduled in desktop outbound Established path.
- **Next safe step**:
  - Run one failing ext-to-ext call and correlate proof events with PBX bridge evidence using `callId`/`corrId`.

### 2026-04-13T05:28:00Z — TASK-033: show PBX DNS/domain on registrations table
- **AI**: Cascade
- **Scope**: read-only admin portal enhancement.
- **Change**:
  - Normalized PBX rows now include `pbxDnsName` (from `PBX_REG_HTTP_URL` hostname) and `pbxDomain` (from SIP AOR host).
  - `/admin/registrations` merged table now shows a **PBX DNS** column (safe placeholder when missing).
- **Files changed**:
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - `/admin/registrations` returns HTTP 200 and includes the `PBX DNS` column.
- **Next safe step**:
  - Wire authoritative PBX live registrations read (read-only) so PBX rows populate in production.

### 2026-04-13T05:04:00Z — TASK-033: merged registrations table + dashboard link
- **AI**: Cascade
- **Scope**: read-only admin portal UI + normalization only.
- **Change**:
  - `/admin/registrations` now renders a single merged table with normalized columns (extension/AOR/status/contact/user-agent/expires/transport).
  - Dashboard navbar now includes a visible **Registrations** link.
- **PBX source**:
  - Optional HTTP scrape via `PBX_REG_HTTP_URL` (still non-fatal; page renders health when unavailable).
- **Files changed**:
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
  - `push-server/dashboard.html`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server`
- **Verified result**:
  - `/dashboard`, `/admin/routing`, `/admin/calllogs`, `/admin/registrations` return HTTP 200.
  - `/dashboard` and admin pages contain a `/admin/registrations` link.
- **Next safe step**:
  - Wire authoritative PBX live registrations read (read-only) so merged view can show PBX-only and both.

### 2026-04-13T02:27:00Z — Docs: restore missing TASK-032 task file
- **AI**: Cascade
- **Scope**: docs/workflow only (correction; no code changes).
- **Correction**:
  - Recreated missing `docs/tasks/TASK-032.md` from authoritative workflow history sources:
    - `docs/change-ledger.md`
    - `docs/session-log.md`
    - `docs/tasks/Index.md`
    - `docs/now.md`
- **Files changed**:
  - `docs/tasks/TASK-032.md`
  - `docs/change-ledger.md`
  - `docs/session-log.md`
- **Restart required**:
  - No
- **Verified result**:
  - `docs/tasks/TASK-032.md` exists in the worktree and matches recorded timestamps/status transitions.
- **Next safe step**:
  - None (docs correction only).

### 2026-04-13T02:19:00Z — TASK-033: /admin/registrations page renders (Kamailio live; PBX pending)
- **AI**: Cascade
- **Scope**: read-only admin feature.
- **Route**:
  - `/admin/registrations` (WireGuard-only)
- **Data sources**:
  - Kamailio usrloc: live via JSON-RPC over HTTP on `http://127.0.0.1:8443/RPC` (`ul.dump location`).
  - PBX registrations: not wired yet (page renders health as unavailable).
- **Verification**:
  - Rebuilt + restarted push-server so new route is live.
  - HTTP check: `/admin/registrations` returns 200.

### 2026-04-13T02:15:00Z — TASK-033: start admin registrations page (live Kamailio usrloc)
- **AI**: Cascade
- **Scope**: read-only admin feature.
- **Kamailio source of truth**:
  - Enabled JSON-RPC over HTTP (localhost-only) on `http://127.0.0.1:8443/RPC` to query live usrloc via `ul.dump`.
- **Admin portal wiring**:
  - Added `/admin/registrations` route and a read-only HTML page renderer.
  - PBX side is not yet wired (page must still render and show source health).
- **Files changed**:
  - `kamailio/kamailio.cfg`
  - `push-server/src/routes/adminRoutes.js`
  - `push-server/src/services/registrations/readLiveRegistrations.js`
  - `push-server/src/admin/registrationsPage.js`
  - `push-server/src/admin/routingPage.js`
  - `push-server/src/admin/callLogPage.js`
- **Next safe step**:
  - Implement PBX live registrations read path and complete merged dual-registration status rendering.

### 2026-04-13T01:56:00Z — TASK-026: split registration route (20-registration) into core + helpers
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving; size ceiling compliance).
- **Boundary completed**:
  - Split oversized `kamailio/routes/20-registration.cfg` into exactly two coherent include files:
    - `kamailio/routes/20-registration-helpers.cfg` (NAT fix, failure_route, local save, unregister)
    - `kamailio/routes/20-registration-core.cfg` (HANDLE_REGISTER + RELAY_REGISTER_TO_PBX)
  - `kamailio/routes/20-registration.cfg` is now an include-only wrapper.
- **Verification**:
  - In-container parse check BEFORE: `docker compose exec -T kamailio kamailio -c /etc/kamailio/kamailio.cfg -I` (OK)
  - In-container parse check AFTER: same command (OK)
- **Next safe step**:
  - Reduce `kamailio/kamailio.cfg` (still oversized) by extracting additional large route blocks into `kamailio/routes/*` includes.

### 2026-04-13T01:51:00Z — TASK-026: split incoming route (10-incoming) into core + did-map
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving; size ceiling compliance).
- **Boundary completed**:
  - Split oversized `kamailio/routes/10-incoming.cfg` into exactly two coherent include files:
    - `kamailio/routes/10-incoming-did-map.cfg` (DID→extension mapping helper route)
    - `kamailio/routes/10-incoming-core.cfg` (main `HANDLE_INCOMING_INVITE` route)
  - `kamailio/routes/10-incoming.cfg` is now an include-only wrapper.
- **Verification**:
  - In-container parse check BEFORE: `docker compose exec -T kamailio kamailio -c /etc/kamailio/kamailio.cfg -I` (OK)
  - In-container parse check AFTER: same command (OK)
- **Next safe step**:
  - Reduce `kamailio/routes/20-registration.cfg` (203 lines) via a similar two-file split, keeping REGISTER behavior identical.

### 2026-04-13T01:45:00Z — TASK-026: isolate Kamailio push route include (first boundary)
- **AI**: Cascade
- **Scope**: Kamailio isolation/refactor (behavior-preserving).
- **Boundary completed**:
  - Extracted push notification routing (`route[SEND_PUSH_NOTIFICATION]`) from the main `kamailio/kamailio.cfg` into a dedicated include file.
- **Files changed**:
  - `kamailio/kamailio.cfg`
  - `kamailio/routes/70-push.cfg`
- **Verification**:
  - Code inspection: `kamailio/kamailio.cfg` no longer defines `route[SEND_PUSH_NOTIFICATION]` and now includes `routes/70-push.cfg`.
  - Runtime/container verification: not performed in this step.
- **Next safe step**:
  - Run `kamailio -c` config parse in the container and verify inbound/outbound calls unchanged.

### 2026-04-13T01:38:00Z — Docs: task state update (TASK-032 → Pending; restore TASK-026)
- **AI**: Cascade
- **Scope**: docs/workflow only.
- **Change**:
  - Marked TASK-032 as `Pending` (runtime verification paused).
  - Restored TASK-026 (Kamailio isolation/refactor) into `docs/tasks/` based on existing session-log history and set it as the active task.
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-026.md`

### 2026-04-13T01:26:00Z — TASK-032: desktop hard-refresh loop fix (one-shot consume)
- **AI**: Cascade
- **Scope**: desktop runtime UX fix (hard-refresh/cache only).
- **Proof / symptom**:
  - After manual hard refresh, `[POST_REFRESH_BOOT] hr=1 ... href=...&hr=1` and `[DESKTOP_HARD_REFRESH_PREV_CLICK] ... href=...&hr=1` observed.
  - Page refreshed again during early login input activity.
- **Fix**:
  - `www/app/desktop/runtime/ext/desktopCacheHardRefreshSetup.js` now consumes hard-refresh state on first boot:
    - clears `__desktop_hard_refresh_click_ts` from localStorage
    - removes `hr=1` from the URL via `history.replaceState`
    - emits `[DESKTOP_HARD_REFRESH_CONSUMED] ...` marker
- **Next safe step**:
  - Verify: one refresh click triggers exactly one reload; after reload, typing username does not reload; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T01:14:00Z — TASK-032: inbound stats 404 fix (pc/stats import path)
- **AI**: Cascade
- **Scope**: desktop inbound runtime unblock (stats/diag import only; no media behavior change).
- **Symptom**:
  - Browser tried to import `/app/desktop/pc/stats.js?...` and 404’d during inbound established flow.
- **Root cause**:
  - `www/app/desktop/incoming/ext/desktopIncomingPcStats.js` used a relative import path that resolved under `/app/desktop/...`.
- **Fix**:
  - Updated dynamic import URL from `../../pc/stats.js` to `../../../pc/stats.js` (resolves to real `www/app/pc/stats.js`).
- **Next safe step**:
  - Re-test inbound call establish: confirm `loadPcStats` import succeeds and stats snapshots continue without 404; then resume TASK-032 ext-to-ext SIP 480 proof pass.

### 2026-04-13T01:09:00Z — TASK-032: desktop bootstrap fix (export createDesktopInviter)
- **AI**: Cascade
- **Scope**: desktop runtime bootstrap unblock (export mismatch fix).
- **Fix**:
  - `www/app/desktop/outgoing/desktopStartCallSupport.js` now exports `createDesktopInviter` and `getDesktopOutboundDiagContext` for callers under `www/app/desktop/outgoing/ext/`.
- **Symptom**:
  - `SyntaxError: ... does not provide an export named 'createDesktopInviter'` from `desktopExtInviteFlow.js`.
- **Next safe step**:
  - Reload desktop app and confirm bootstrap/login UI renders; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T01:07:00Z — TASK-032: desktop bootstrap fix (remove stale outbound sender diagnostics import)
- **AI**: Cascade
- **Scope**: desktop runtime bootstrap unblock (no SIP logic changes).
- **Fix**:
  - Removed stale import of deleted `www/app/desktop/outgoing/desktopOutboundSenderDiagnostics.js`.
  - Updated `www/app/desktop/outgoing/desktopOutboundStateChange.js` to import the required functions from existing `www/app/desktop/outgoing/ext/` modules.
- **Verified result**:
  - Repo search returns zero references to `desktopOutboundSenderDiagnostics.js`.
- **Next safe step**:
  - Re-test desktop app loads past bootstrap and login UI renders; then resume TASK-032 SIP 480 proof pass.

### 2026-04-13T00:48:00Z — Docs: correct TASK-032 start date in task index
- **AI**: Cascade
- **Scope**: docs/workflow only (metadata consistency).
- **Files changed**:
  - `docs/tasks/Index.md`
- **Restart required**:
  - No
- **Verified result**:
  - `docs/now.md` shows TASK-032 active.
  - `docs/change-ledger.md` contains `2026-04-13T05:15:00Z — TASK-032: start state`.
  - `docs/tasks/Index.md` TASK-032 start date set to `2026-04-13`.
- **Next safe step**:
  - Continue TASK-032 runtime proof pass for desktop outbound ext-to-ext 480 branch.

### 2026-04-13T05:15:00Z — TASK-032: start state (runtime/correctness only; post-isolation)
- **AI**: Cascade
- **Scope**: runtime/correctness debugging only (no isolation/refactor work; desktop isolation is complete).
- **Handoff context**:
  - TASK-031 is complete/closed; authoritative history: `docs/tasks/TASK-031.md`.
- **Current blocker(s)**:
  - Desktop outbound extension-to-extension calls may reject/terminate early (477/480).
  - OS/browser mic indicator may remain on after hangup despite app-level release proof.
- **Exact next safe step**:
  - Reproduce 477/480 and mic-stuck reliably, then add observability-only instrumentation where needed (no refactors unless required by file-size ceiling).

### Archived TASK-031 entries

- Moved into `docs/tasks/TASK-031.md` (final historical record). This live ledger is intentionally kept minimal for TASK-032.

### 2026-04-26 22:12 PKT — TASK-034: admin create-account regression verification
- **AI**: Codex
- **Files changed**:
  - `docs/now.md`
  - `docs/tasks/Index.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server` completed.
- **Verified result**:
  - Docker live create route restored: `POST /admin/provisioning/account/create` returned 201; duplicate returned 409; invalid input returned 400; admin HTML/API responses contained no `sip_password` or `pin_hash`; store retained PIN/hash/SIP password only in mounted data.
- **Next safe step**:
  - Resume TASK-034 browser logout click-path proof; active slot release and visible credential cleanup remain separate blockers.

### 2026-04-28 00:31 PKT — TASK-034: foolproof active-slot/logout hardening
- **AI**: Codex
- **Files changed**:
  - `push-server/src/services/provisioning/provisioningActiveSlotStore.js`
  - `push-server/src/services/provisioning/desktopProvisioningService.js`
  - `push-server/src/services/provisioning/provisionedDeviceStore.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningSession.js`
  - `www/app/desktop/features/auto_provisioning/desktopProvisioningFlow.js`
  - `www/app/desktop/registration/desktopRegistration.js`
  - `www/app/desktop/bindings/desktopControlBindings.js`
  - `www/app/desktop/ui/desktopShellSections.js`
  - `docs/now.md`
  - `docs/tasks/TASK-034.md`
  - `docs/session-log.md`
  - `docs/change-ledger.md`
- **Restart required**:
  - Yes: `docker compose up -d --build push-server` completed.
- **Verified result**:
  - Docker/API tests passed: `max_devices=1` login/block/logout/login sequence, stale active TTL release, revoked-device block, admin Release Active, secret checks, and served desktop logout diagnostics. Current stale active `51666785` slot was released without deleting/revoking.
- **Next safe step**:
  - Browser hard refresh and real power/logout click proof; TASK-034 remains active until console logs and admin Devices row show `active=false`.
