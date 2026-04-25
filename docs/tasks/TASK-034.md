# TASK-034 — Desktop Auto Provisioning (Provisioning ID + PIN + device limits + admin controls)

Start date: 2026-04-25

## Goal
Enable **desktop-only** auto provisioning so a desktop client can obtain SIP/WebRTC credentials from the backend using a **Provisioning ID + PIN**, then write the returned config into existing desktop account settings and trigger existing registration normally.

## Non-negotiable scope guardrails
- Desktop only (do not touch Android or iOS).
- Do not refactor existing working registration/calling/media logic.
- Do not disturb existing manual configuration flow.
- Do not implement API-based calling.
- Keep provisioning isolated behind desktop-owned modules and backend provisioning-specific routes/services.

## Required behavior
- Desktop UI: Auto Provision button/icon opens modal.
- Modal fields:
  - Provisioning ID
  - PIN
  - Save Provisioning ID and PIN on this device (optional)
- Request: `POST /api/provisioning/desktop` with device metadata.
- Backend validations:
  - provisioning account enabled
  - auto provision enabled
  - correct PIN
  - max device limit not exceeded (same device does not consume new slot)
  - device not revoked
- Success:
  - backend returns only required config fields
  - desktop writes config via a single isolated adapter into existing settings
  - desktop triggers existing registration/reconnect behavior (existing flow)
- Failure:
  - do not overwrite existing config
  - show clear error message

## Backend/admin requirements (minimum)
- Provisioning account model/record fields:
  - client/name label
  - provisioning_id
  - pin hash (do not store plain PIN if hashing exists)
  - internal label
  - sip_username
  - sip_password (or encrypted secret if project already supports it)
  - sip_domain
  - websocket_url (if required by dialer config)
  - transport
  - auto_provision_enabled
  - account_enabled
  - max_devices
  - notes/status if existing patterns support
- Admin controls:
  - enable/disable auto provision
  - disable provisioning account
  - reset PIN
  - change SIP password
  - set max devices
  - view provisioned devices
  - revoke device

## Device tracking
Track provisioned desktop devices:
- provisioning account reference
- device_id
- device_name (if available)
- platform/OS (if available)
- app_version (if available)
- first provisioned timestamp
- last provisioned timestamp
- revoked boolean

Rules:
- same device can re-provision without consuming a new slot
- new devices count against max_devices
- revoked devices cannot provision

## Recommended code boundaries (subject to repo conventions)
### Desktop
`www/app/desktop/features/auto_provisioning/`
- UI/modal/icon
- API client
- device id manager
- saved provisioning credential storage (desktop-only)
- config mapper/validator
- settings write adapter (single writer)
- registration trigger adapter (single trigger)

### Backend
`push-server/src/services/provisioning/*`
`push-server/src/routes/*`
`push-server/src/admin/*`

## Security requirements
- No public exposure of provisioning records.
- No network-based reverse DNS lookups.
- Return only what the desktop needs (no internal/admin fields).
- If rate limiting / attempt tracking exists already, reuse it; otherwise record as remaining risk.

## TASK-034 verification rule (container-only)
- Verification and runtime commands must be Docker/container-only.
- Do not use host Node checks (`node -c`, `node -e`) for TASK-034 verification.
- Example verification commands:
  - `docker compose exec push-server node -c src/routes/adminRoutes.js`
  - `docker compose exec push-server node -c src/services/provisioning/provisioningAccountStore.js`
  - `docker compose exec push-server node -e "require('./src/routes/adminRoutes')"`
- Example runtime commands:
  - `docker compose up -d --build push-server`
  - `curl -sS http://localhost:<push-server-port>/admin/provisioning`

## Docker-only backend API test procedure (seed + POST /api/provisioning/desktop)

### 1) Start push-server with PROVISIONING_PIN_PEPPER set
- Set `PROVISIONING_PIN_PEPPER` in `.env` (recommended) or inject it at runtime.
- Runtime injection example (does not persist):
  - `PROVISIONING_PIN_PEPPER=tmppepper docker compose up -d --build push-server`

### 2) Seed one provisioning account (in-container)
- This writes dummy credentials to the file-based store in the container.
- Replace only the provisioning identifiers as needed; keep dummy SIP values.

```bash
docker compose exec -T push-server node -e "const fs=require('fs');const path=require('path');const crypto=require('crypto');const {hashPin}=require('./src/conference/pinHash');const dir=path.join(process.cwd(),'data','provisioning');fs.mkdirSync(dir,{recursive:true});const pepper=String(process.env.PROVISIONING_PIN_PEPPER||'').trim();if(!pepper){console.error('missing PROVISIONING_PIN_PEPPER');process.exit(2);}const pin='1234';const acc={provisioning_id:'test-prov-1',label:'Test',internal_label:'Test',enabled:true,auto_provision_enabled:true,max_devices:1,sip_username:'1001',sip_password:'DUMMY_SIP_PASSWORD',sip_domain:'example.com',websocket_url:'wss://example.com/ws',transport:'wss',pin_hash:hashPin(pin,pepper)};const p=path.join(dir,'accounts.json');let cur=[];try{const j=JSON.parse(fs.readFileSync(p,'utf8'));cur=Array.isArray(j)?j:(Array.isArray(j?.accounts)?j.accounts:[]);}catch{};const next=cur.filter(a=>String(a?.provisioning_id||'').trim()!==acc.provisioning_id);next.push(acc);fs.writeFileSync(p,JSON.stringify({accounts:next,savedAt:new Date().toISOString()},null,2));console.log('seeded',p,'pin',pin);"
```

### 3) Call the provisioning API
- Route: `POST /api/provisioning/desktop`

```bash
curl -sS -X POST http://127.0.0.1:3001/api/provisioning/desktop \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","pin":"1234","device_id":"dev-1","device_name":"Test Laptop","platform":"linux","app_version":"0.0.0"}'
```

### Expected success response
- HTTP 200:
  - `{ "success": true, "config": { ... } }`
- `config` fields returned by the backend:
  - `display_name`
  - `sip_username`
  - `sip_password`
  - `sip_domain`
  - `websocket_url`
  - `transport`

### Failure tests (Docker-only)

#### Wrong PIN
```bash
curl -sS -X POST http://127.0.0.1:3001/api/provisioning/desktop \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","pin":"9999","device_id":"dev-1"}'
```
- Expected: HTTP 403 `{ "success": false, "error_code": "INVALID_CREDENTIALS", ... }`

#### Device limit reached (max_devices=1)
- First, provision device `dev-1` successfully.
- Then try a different device ID:
```bash
curl -sS -X POST http://127.0.0.1:3001/api/provisioning/desktop \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","pin":"1234","device_id":"dev-2"}'
```
- Expected: HTTP 403 `{ "success": false, "error_code": "DEVICE_LIMIT_REACHED", ... }`

#### Revoked device
- Revoke `dev-1` via admin endpoint (WireGuard-only):
```bash
curl -sS -X POST http://127.0.0.1:3001/admin/provisioning/device/revoke \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","device_id":"dev-1","revoked":true}'
```
- Then attempt provisioning:
```bash
curl -sS -X POST http://127.0.0.1:3001/api/provisioning/desktop \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","pin":"1234","device_id":"dev-1"}'
```
- Expected: HTTP 403 `{ "success": false, "error_code": "DEVICE_REVOKED", ... }`

#### auto_provision_enabled false
- Disable auto provisioning via admin update endpoint:
```bash
curl -sS -X POST http://127.0.0.1:3001/admin/provisioning/account/update \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","auto_provision_enabled":false}'
```
- Then attempt provisioning:
```bash
curl -sS -X POST http://127.0.0.1:3001/api/provisioning/desktop \
  -H 'Content-Type: application/json' \
  -d '{"provisioning_id":"test-prov-1","pin":"1234","device_id":"dev-1"}'
```
- Expected: HTTP 403 `{ "success": false, "error_code": "AUTO_PROVISION_DISABLED", ... }`

## Desktop boundaries (inspected)

### Current desktop settings persistence boundary
- File: `www/app/desktop/registration/ext/desktopRegistrationStorage.js`
- Function: `persistDesktopLastRegistration({ ext, domain, wss })`
- Storage: `localStorage` key `webrtc_last_registration`

### Current password/session boundary
- File: `www/app/desktop/desktopRecoverySession.js`
- Functions:
  - `saveSessionPassword(pass)`
  - `hydratePasswordInput(passInput, logLine)`
  - `clearSessionPassword()`
- Storage: `sessionStorage` key `webrtc_last_pass`

### Current registration trigger boundary
- File: `www/app/desktop/registration/desktopRegistration.js`
- Function: `registration.startAndRegister()` (from `createDesktopRegistration(...)`)
- Reads ext/domain/wss/pass from the existing desktop DOM/UI path (prefers `desktopEl.pass.value`).

## Approved future desktop adapter design (desktop-only)
- Add isolated feature folder: `www/app/desktop/features/auto_provisioning/`.
- On provisioning success:
  - populate existing desktop DOM inputs (ext/domain/wss/pass)
  - call `saveSessionPassword(pass)`
  - persist ext/domain/wss via `persistDesktopLastRegistration({ ext, domain, wss })`
  - call `registration.startAndRegister()`
- Do not modify `www/app/desktop/registration/desktopRegistration.js`.

## Credential-save risk (not solved yet)
- “Save Provisioning ID + PIN” likely requires `localStorage` for persistence across restart.
- This would be plaintext unless an existing secure storage mechanism already exists.
- Treat as remaining risk until a repo-supported secure storage option is found.

## Next safe step
- Implement desktop auto provisioning UI (desktop-only) and keep backend/admin provisioning controls stable.

## Backend/admin boundaries (inspected)

### Backend framework
- push-server is Node.js + Express.
- Entrypoint: `push-server/server.js`.
- Admin routes: `push-server/src/routes/adminRoutes.js`.
- Admin pages: `push-server/src/admin/*Page.js` (HTML rendered from JS).

### Access control
- Admin endpoints are protected by `requireWireGuardAccess()` from `push-server/src/middleware/accessControl.js`.
- No separate admin login/session layer found in the inspected path.

### Persistence pattern
- No DB/migration framework found in push-server dependencies.
- Existing persistence uses file-based JSON (examples: routing config JSON file; metadata JSON files).
- TASK-034 should follow an isolated file-based provisioning store unless project owner later requests a DB.

### Approved future backend files (isolation-first)
- `push-server/src/services/provisioning/provisioningAccountStore.js`
- `push-server/src/services/provisioning/provisionedDeviceStore.js`
- `push-server/src/services/provisioning/desktopProvisioningService.js`
- `push-server/src/routes/provisioningRoutes.js`
- `push-server/src/admin/provisioningPage.js`

### Future minimal shared touches
- `push-server/server.js` only to mount `/api/provisioning`.
- `push-server/src/routes/adminRoutes.js` only to add `/admin/provisioning` controls.

### Security findings
- PIN hash pattern exists: `push-server/src/conference/pinHash.js` (`hashPin(pin, pepper)` uses `sha256(pin:pepper)`).
- This is not a slow hash.
- Deployment requirement: `PROVISIONING_PIN_PEPPER` must be set; provisioning rejects requests with `SERVER_MISCONFIGURED` if missing.
- No first-party SIP secret encryption helper found in inspected push-server source.
- SIP password storage may be plaintext unless a new encryption helper is added later (treat as remaining risk).

## Route/admin integration patterns (inspected)

### API route pattern
- Route module is a factory that returns an Express router.
- Export shape: `create<Name>Routes`.
- `push-server/server.js` mounts with `app.use('/api/<name>', create<Name>Routes({ ...deps }))`.

### Approved future API route
- File: `push-server/src/routes/provisioningRoutes.js`
- Export: `createProvisioningRoutes(deps)`
- Mount: `/api/provisioning`
- Endpoint: `POST /api/provisioning/desktop`

### Current API route module (implemented, not mounted yet)
- File: `push-server/src/routes/provisioningRoutes.js`
- Factory: `createProvisioningRoutes()`
- Route: `POST /desktop`
  - Calls `provisionDesktop(req.body)`
  - Success: HTTP 200 `{ success: true, config }`
  - Failure: HTTP `<status>` `{ success: false, error_code, message }`
- Not mounted in `push-server/server.js` yet.

### Admin pattern
- `push-server/src/routes/adminRoutes.js` owns `/admin/*` routes.
- Each admin route uses `requireWireGuardAccess` middleware.
- Admin pages render HTML strings from `push-server/src/admin/*Page.js`.
- Admin actions use `fetch` POST with JSON body and JSON response.

### Approved future admin files/routes
- File: `push-server/src/admin/provisioningPage.js`
- Routes:
  - `GET /admin/provisioning`
  - `POST /admin/provisioning/account/update`
  - `POST /admin/provisioning/device/revoke`
- Exact endpoint list can be finalized during implementation.

### Security/risk findings (routes/admin)
- No CSRF token pattern found.
- No admin login/session found in inspected admin path.
- Admin protection is WireGuard IP gating only.
- In-memory rate limiter pattern exists in `push-server/src/routes/conferenceRoutes.js` and can be reused for provisioning attempts.
- Provisioning admin endpoints must validate inputs before persistence.
## Timestamped task history
- 2026-04-25 03:05 PKT | START | TASK-034 | Docs/workflow setup only (create task file; update now/index/ledgers). | AI: Cascade
- 2026-04-25 03:12 PKT | NOTE  | TASK-034 | Recorded inspected desktop boundaries: registration settings persistence, session password storage, and registration trigger path; defined adapter design to populate DOM + call existing registration unchanged. | AI: Cascade
- 2026-04-25 03:15 PKT | NOTE  | TASK-034 | Recorded inspected backend boundaries: push-server Express entrypoints, WireGuard-only admin access control, file-based JSON persistence pattern, and available sha256+pepper PIN hash helper; no existing SIP secret encryption helper found. | AI: Cascade
- 2026-04-25 03:17 PKT | NOTE  | TASK-034 | Recorded route/admin integration patterns: Express router factory mount style, WireGuard-only admin route patterns, lack of CSRF/session auth, and existing in-memory rate limiter example suitable for provisioning attempts. | AI: Cascade
- 2026-04-25 03:19 PKT | CHANGE | TASK-034 | Added storage-only backend provisioning stores (file-based JSON): provisioning account store + provisioned device store + path helpers (no route mounts; no admin UI). | AI: Cascade
- 2026-04-25 03:22 PKT | CHANGE | TASK-034 | Added provisioning service logic (`provisionDesktop`) enforcing account enabled/auto-provision, PIN hash match (sha256+pepper), device revocation, and max device limits; returns minimal config only (no routes mounted). | AI: Cascade
- 2026-04-25 03:24 PKT | CHANGE | TASK-034 | Hardened provisioning service: require `PROVISIONING_PIN_PEPPER`; when missing, reject provisioning with `SERVER_MISCONFIGURED` (500). | AI: Cascade
- 2026-04-25 03:26 PKT | CHANGE | TASK-034 | Added provisioning API route module `push-server/src/routes/provisioningRoutes.js` (POST /desktop) delegating to service; not mounted in server.js yet. | AI: Cascade
- 2026-04-25 03:29 PKT | NOTE  | TASK-034 | Recorded provisioning route module details: `createProvisioningRoutes()` defines POST `/desktop` delegating to `provisionDesktop(req.body)` and returns `{success:true, config}` or `{success:false, error_code, message}`; still not mounted. | AI: Cascade
- 2026-04-25 03:30 PKT | CHANGE | TASK-034 | Mounted provisioning API: `push-server/server.js` now mounts `/api/provisioning` using `createProvisioningRoutes()` (minimal shared edit). | AI: Cascade
- 2026-04-25 03:34 PKT | CHANGE | TASK-034 | Added read-only admin provisioning page: `GET /admin/provisioning` renders accounts/devices summary (no SIP password or PIN hash shown). | AI: Cascade
- 2026-04-25 03:39 PKT | CHANGE | TASK-034 | Added minimal admin write controls: `POST /admin/provisioning/account/update` updates only enabled/auto_provision_enabled/max_devices (WireGuard-only; input validation; no secrets shown on page). | AI: Cascade
- 2026-04-25 03:44 PKT | NOTE  | TASK-034 | Workflow rule: TASK-034 verification must be Docker/container-only; earlier host Node syntax/import checks are superseded going forward. | AI: Cascade
- 2026-04-25 03:44 PKT | CHANGE | TASK-034 | Security fix: admin provisioning account update response is sanitized to avoid returning `sip_password` or `pin_hash` fields. | AI: Cascade
- 2026-04-25 03:52 PKT | CHANGE | TASK-034 | Added admin device revoke/unrevoke control: `POST /admin/provisioning/device/revoke` + devices table actions on `/admin/provisioning` (WireGuard-only; sanitized device response). | AI: Cascade
- 2026-04-25 03:52 PKT | VERIFY | TASK-034 | Docker-only: device revoke/unrevoke POST returns sanitized device JSON; `/admin/provisioning` HTML contains no `sip_password` or `pin_hash`. | AI: Cascade
- 2026-04-25 03:59 PKT | CHANGE | TASK-034 | UI-only refactor: split provisioning admin page into `provisioningPage.js` (main renderer) + `provisioningPageParts.js` (row renderers + client script) to keep each file under 200 lines; no behavior change. | AI: Cascade
- 2026-04-25 03:59 PKT | VERIFY | TASK-034 | Docker-only: syntax checks pass for both provisioning page modules; live GET `/admin/provisioning` returns 200 and HTML contains no `sip_password` or `pin_hash`. | AI: Cascade
- 2026-04-25 04:05 PKT | CHANGE | TASK-034 | Route refactor: split adminRoutes.js into small assembler + dedicated route modules (routing/calllogs/registrations/provisioning) while preserving all /admin route paths and WireGuard gating. | AI: Cascade
- 2026-04-25 04:05 PKT | VERIFY | TASK-034 | Docker-only: syntax checks pass for all new route modules; live GET /admin/(routing|calllogs|registrations|provisioning) returns 200; provisioning update+revoke endpoints still return sanitized JSON; /admin/provisioning HTML contains no sip_password or pin_hash. | AI: Cascade
- 2026-04-25 04:16 PKT | CHANGE | TASK-034 | Added admin PIN reset control: POST `/admin/provisioning/account/reset-pin` (validates numeric PIN length>=4, hashes with `hashPin(pin, PROVISIONING_PIN_PEPPER)`, updates `pin_hash` only) + minimal UI button (prompt-based) on `/admin/provisioning`; responses/pages remain sanitized (no `sip_password`/`pin_hash`). | AI: Cascade
- 2026-04-25 04:16 PKT | VERIFY | TASK-034 | Docker-only: syntax checks pass; missing pepper returns 500 SERVER_MISCONFIGURED; invalid PIN returns 400; success reset returns 200 with sanitized account JSON (no `sip_password`/`pin_hash`); `/admin/provisioning` HTML contains no `sip_password`/`pin_hash`. | AI: Cascade
- 2026-04-25 04:30 PKT | CHANGE | TASK-034 | Added admin SIP password change endpoint: POST `/admin/provisioning/account/change-sip-password` (validates sip_password length>=6; updates `sip_password` only) and returns sanitized account JSON (no `sip_password`/`pin_hash`). | AI: Cascade
- 2026-04-25 04:30 PKT | VERIFY | TASK-034 | Docker-only: syntax check passed; invalid password returns 400; success returns 200 with sanitized account JSON; `/admin/provisioning` HTML contains no `sip_password`/`pin_hash`. | AI: Cascade
- 2026-04-25 04:33 PKT | CHANGE | TASK-034 | UI-only refactor: split `provisioningPageParts.js` into `provisioningPageParts.js` (row renderers) + `provisioningPageScripts.js` (client script) to keep helper file below ceiling; behavior preserved; no new endpoints/UI. | AI: Cascade
- 2026-04-25 04:33 PKT | VERIFY | TASK-034 | Docker-only: syntax checks pass; live GET `/admin/provisioning` returns 200; expected action strings still present; HTML contains no `sip_password` or `pin_hash`. | AI: Cascade
- 2026-04-25 04:50 PKT | CHANGE | TASK-034 | Desktop UI-only refactor: split `www/app/desktop/ui/ext/desktopLayoutSections.js` into assembler + `desktopRegistrationSection.js` (Account/registration markup) to keep each module under ceiling; preserved exported section function names and DOM IDs (`ext`, `pass`, `domain`, `wsshost`); kept hidden domain/WSS row. | AI: Cascade
- 2026-04-25 04:50 PKT | VERIFY | TASK-034 | Docker-only: verified desktop page still loads after refactor (HTTP 200 for `/?mode=desktop`). | AI: Cascade
 - 2026-04-25 04:55 PKT | CHANGE | TASK-034 | Desktop UI-only: added Auto Provision button + hidden modal skeleton in `www/app/desktop/ui/ext/desktopRegistrationSection.js` (no API call, no storage, no settings write, no registration trigger). | AI: Cascade
 - 2026-04-25 04:55 PKT | VERIFY | TASK-034 | Docker-only: desktop page loads (HTTP 200 for `/?mode=desktop`); served module `app/desktop/ui/ext/desktopRegistrationSection.js` contains Auto Provision IDs/text and preserves manual field IDs (`ext`, `pass`, `domain`, `wsshost`). | AI: Cascade
 - 2026-04-25 05:00 PKT | CHANGE | TASK-034 | Desktop UI-only: added modal bindings module `www/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` and wired it from `desktopControlBindings.js` to show/hide the Auto Provision modal and show a local "not wired yet" status on Configure (no API call, no storage, no settings write, no registration trigger). | AI: Cascade
 - 2026-04-25 05:00 PKT | VERIFY | TASK-034 | Docker-only: desktop page loads; served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` contains `bindDesktopAutoProvisioningModalHandlers`; served `desktopRegistrationSection.js` still contains modal skeleton IDs and preserves manual field IDs (`ext`, `pass`, `domain`, `wsshost`). | AI: Cascade
 - 2026-04-25 05:05 PKT | CHANGE | TASK-034 | Desktop runtime: added isolated provisioning API client `www/app/desktop/features/auto_provisioning/desktopProvisioningClient.js` exporting `requestDesktopProvisioning(...)` (no UI wiring; no storage; no settings write; no registration trigger). | AI: Cascade
 - 2026-04-25 05:05 PKT | VERIFY | TASK-034 | Docker-only: served `/app/desktop/features/auto_provisioning/desktopProvisioningClient.js` contains endpoint string `/api/provisioning/desktop` and export `requestDesktopProvisioning`. | AI: Cascade
 - 2026-04-25 05:10 PKT | CHANGE | TASK-034 | Desktop runtime: added isolated settings-write adapter `www/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js` exporting `applyProvisionedConfigToDesktopInputs(...)` to write provisioned SIP config into existing desktop inputs + call `saveSessionPassword` and `persistDesktopLastRegistration` (no API call; no registration trigger). | AI: Cascade
 - 2026-04-25 05:10 PKT | VERIFY | TASK-034 | Docker-only: served `/app/desktop/features/auto_provisioning/applyProvisionedConfigToDesktopInputs.js` contains export `applyProvisionedConfigToDesktopInputs` and does not reference `registration.startAndRegister`. | AI: Cascade

- 2026-04-25 06:07 PKT | CHANGE | TASK-034 | Desktop runtime: wired Auto Provision modal Configure click to validate Provisioning ID + PIN, call `requestDesktopProvisioning(...)`, and apply returned config to desktop inputs via `applyProvisionedConfigToDesktopInputs(...)` (no credential storage; no registration trigger). | AI: Cascade
- 2026-04-25 06:07 PKT | VERIFY | TASK-034 | Docker-only: desktop page loads (HTTP 200 for `https://localhost/?mode=desktop`); served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` includes imports for client+adapter and does not reference `registration.startAndRegister`; live POST `/api/provisioning/desktop` still returns JSON error when misconfigured. | AI: Cascade

- 2026-04-25 06:13 PKT | CHANGE | TASK-034 | Desktop runtime: after successful provisioning + config apply, Auto Provision modal now triggers registration by calling injected `startAndRegister()` (narrow validated path; no registration internals changed; no Provisioning ID/PIN storage). | AI: Cascade
- 2026-04-25 06:13 PKT | VERIFY | TASK-034 | Docker-only: desktop page loads (HTTP 200 for `https://localhost/?mode=desktop`); served `/app/desktop/features/auto_provisioning/desktopProvisioningModal.js` references `startAndRegister` only via injected parameter + local wrapper and still imports client+adapter; served modal JS contains no `localStorage`/`sessionStorage` writes for provisioning creds; live POST `/api/provisioning/desktop` still returns JSON. | AI: Cascade

- 2026-04-25 06:25 PKT | CHANGE | TASK-034 | Phase A (manual admin): added WireGuard-only provisioning account create flow: `POST /admin/provisioning/account/create` with validation + duplicate check + PIN hashing, plus `/admin/provisioning` create form UI and generator buttons for 8-digit Provisioning ID and 4-digit PIN (no FusionPBX integration; no desktop changes; sanitized response; page does not display secrets). | AI: Cascade
- 2026-04-25 06:25 PKT | VERIFY | TASK-034 | Docker-only: push-server container can require updated modules; `/admin/provisioning` loads (HTTP 200 on `http://localhost:3001/admin/provisioning`) and HTML contains create form IDs and generator button handlers; HTML contains no `sip_password` or `pin_hash` strings; create route returns SERVER_MISCONFIGURED 500 when `PROVISIONING_PIN_PEPPER` is unset; invalid 7-digit provisioning ID returns 400; invalid 3-digit PIN returns 400. | AI: Cascade

- 2026-04-25 06:36 PKT | CHANGE | TASK-034 | Admin create form fixes: added Show/Hide toggle for unsaved create PIN; aligned create submit payload key to `sip_password` and updated create route to accept/validate `sip_password` (still sanitized responses; still no stored PIN display). | AI: Cascade
- 2026-04-25 06:36 PKT | VERIFY | TASK-034 | Docker-only: push-server container require check passes; `/admin/provisioning` HTML contains `toggleCreatePin()` and create PIN toggle button; served JS body uses `sip_password` (not `sip_pass`); create route returns SERVER_MISCONFIGURED 500 when pepper is unset and response contains no `sip_password`/`pin_hash`. | AI: Cascade

- 2026-04-25 06:42 PKT | CHANGE | TASK-034 | Admin create form: added WebSocket URL auto-fill from SIP domain using configurable template `wss://<sip_domain>:7443`; auto-fill runs on SIP domain blur/change only when WebSocket URL is empty; added Auto-fill button next to WebSocket URL field; empty SIP domain shows small create form error. | AI: Cascade
- 2026-04-25 06:42 PKT | VERIFY | TASK-034 | Docker-only: `/admin/provisioning` returns 200 and served HTML contains WebSocket Auto-fill button; served JS contains `autoFillWebsocketUrlFromDomain()` + `WS_URL_TEMPLATE`; create still uses `sip_password`; HTML contains no `pin_hash` and does not render saved `sip_password`. | AI: Cascade

- 2026-04-25 06:48 PKT | CHANGE | TASK-034 | Infra/config: documented `PROVISIONING_PIN_PEPPER` in `.env.example` as required for admin create provisioning account and desktop provisioning (PIN hashing). No real secret committed. | AI: Cascade
- 2026-04-25 06:48 PKT | VERIFY | TASK-034 | Docker-only: `docker-compose.yml` already passes `PROVISIONING_PIN_PEPPER=${PROVISIONING_PIN_PEPPER}` to push-server; with `PROVISIONING_PIN_PEPPER=test-pepper docker compose up -d --build push-server` the env var is present inside container and admin create returns 201 (no secrets in JSON); without pepper, create still returns SERVER_MISCONFIGURED 500. | AI: Cascade

- 2026-04-25 06:48 PKT | NOTE | TASK-034 | `PROVISIONING_PIN_PEPPER` must be set in `.env` before starting/restarting push-server. Example: `PROVISIONING_PIN_PEPPER='use-a-long-random-secret' docker compose up -d --build push-server` (or set it in `.env` then run `docker compose up -d`). | AI: Cascade

- 2026-04-25 07:07 PKT | CHANGE | TASK-034 | Admin provisioning account management (Phase A manual): renamed Accounts badge to `manual Phase A`; added clear Enabled/Disabled display (`Disabled / Revoked` when enabled=false); added inline Edit/Save for non-secret fields (label/internal/enabled/auto/max/sip user/domain/ws); added WireGuard-only delete endpoint and UI Delete with confirm (also deletes associated devices); improved Reset PIN UX to generate a new 4-digit PIN client-side and show it once after success. | AI: Cascade
- 2026-04-25 07:07 PKT | VERIFY | TASK-034 | Docker-only: rebuilt push-server; `/admin/provisioning` returns 200 and contains `manual Phase A`, Edit, Delete, and Generate New PIN controls; served HTML contains no `pin_hash` or `sip_password`; live POST update accepts non-secret fields and enabled=false renders `Disabled / Revoked`; live POST delete removes account row; reset-pin returns sanitized JSON and UI shows new PIN once. | AI: Cascade

- 2026-04-25 07:14 PKT | CHANGE | TASK-034 | Phase A convenience: store retrievable `provisioning_pin` alongside `pin_hash` in provisioning accounts JSON on create and reset-pin. Admin table now includes a masked PIN column (`••••`) with reveal/hide toggle (WireGuard-only admin page). | AI: Cascade
- 2026-04-25 07:14 PKT | VERIFY | TASK-034 | Docker-only: rebuilt push-server; POST /admin/provisioning/account/create stores both `pin_hash` + `provisioning_pin` in `data/provisioning/accounts.json`; POST reset-pin updates both; `/admin/provisioning` shows masked PIN by default and includes reveal toggle; admin HTML contains no `pin_hash` or `sip_password` and no `read-only`; desktop `/api/provisioning/desktop` response contains no `provisioning_pin`/`pin_hash`/`sip_password`. | AI: Cascade

- 2026-04-25 07:32 PKT | CHANGE | TASK-034 | Admin provisioning UI: enabled checkbox label is now dynamic to match state (`enabled` when checked, `revoked` when unchecked) and updates immediately on toggle before saving. Status column remains `Enabled` / `Disabled / Revoked`. | AI: Cascade
- 2026-04-25 07:32 PKT | VERIFY | TASK-034 | Docker-only: rebuilt push-server; `/admin/provisioning` loads and disabled accounts render checkbox label `revoked` while enabled accounts render `enabled`; served JS includes `syncEnabledLabel` + DOMContentLoaded binder; HTML contains no `pin_hash` or `sip_password`. | AI: Cascade

- 2026-04-25 07:39 PKT | CHANGE | TASK-034 | Admin provisioning UI: Accounts table "Revoked" column clarified to "Account revoked" and now reflects account state only (Yes when enabled=false, No when enabled=true). This avoids confusion with revoked device counts, which remain in the Devices section. | AI: Cascade
- 2026-04-25 07:39 PKT | VERIFY | TASK-034 | Docker-only: rebuilt push-server; `/admin/provisioning` shows disabled account row with Account revoked=Yes and enabled account row with Account revoked=No; Devices table still includes its own Revoked column; HTML contains no `pin_hash` or `sip_password`. | AI: Cascade

- 2026-04-25 08:10 PKT | CHANGE | TASK-034 | Desktop auto-provisioning: fix registration/config compatibility by making provisioned `websocket_url` optional (Phase A PBX flow) and normalizing provisioned websocket value before writing to the desktop `wsshost` input (strip scheme/path to host:port). When websocket_url is empty, adapter does not overwrite existing WSS host input. Added safe diagnostics logging of applied `ext/domain/wsshost` without password. | AI: Cascade
- 2026-04-25 08:10 PKT | VERIFY | TASK-034 | Docker-only: desktop bundle includes adapter normalization + empty handling; modal logs `ext/domain/wsshost` only (no password logging); desktop page loads. | AI: Cascade

- 2026-04-25 08:17 PKT | CHANGE | TASK-034 | Desktop registration diagnostics: added decisive safe logs immediately before SIP.js UA construction/start to include `ext`, `domain`, normalized `wss` and `transportOptions.server`, plus `pass_set` true/false. Added exception capture for UA constructor and `ua.start()` failures logging error name/message and first stack line only. Removed password-length logging. No registration behavior changes. | AI: Cascade
- 2026-04-25 08:17 PKT | VERIFY | TASK-034 | Docker-only: served desktop JS contains new `[DESKTOP_REG_DEBUG] UA opts` and exception detail logs; no password value logging added; desktop page loads. | AI: Cascade

- 2026-04-25 08:26 PKT | CHANGE | TASK-034 | Phase A fix: desktop auto-provisioning adapter no longer writes provisioned `websocket_url` into the desktop `wsshost` field (which was forcing a non-working WSS endpoint and breaking previously working registration). Auto provisioning now applies only ext/username + password + domain and preserves existing manual/default WSS field; persisted last-registration uses the existing `wsshost` value. | AI: Cascade
- 2026-04-25 08:26 PKT | VERIFY | TASK-034 | Docker-only: served JS shows no `websocket_url` references and no `wsshost` overwrite in the provisioning adapter; desktop page loads; UA diagnostics remain in place and still do not log password. | AI: Cascade
