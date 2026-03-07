# Changes Log

## Current Working Changes

### Frontend Modular Split

#### `www/index.html`
- Reworked into a thin shell (module bootstrap + root mount point)
- Moved inline CSS and inline JS behaviors into modular files

#### `www/styles/*`
- Added activity-based CSS split:
	- `theme.css`
	- `forms-buttons.css`
	- `dialpad-tabs.css`
	- `history-log-responsive.css`
	- `index.css` (aggregator)

#### `www/app/layout/*`
- Added layout sections as small modules:
	- `headerSection.js`
	- `statusBarSection.js`
	- `registrationSection.js`
	- `dialpadSection.js`
	- `logSection.js`
	- `renderAppLayout.js`

#### `www/app/page/*`
- Added page behavior modules:
	- `bootstrapPage.js`
	- `dialpadInput.js`
	- `cacheActions.js`
	- `debugToggleUi.js`

### Remote Logging + Device Identity

#### `www/app/remoteLogs.js`
- Added robust identity fields in metadata payload:
	- `browserId`
	- `deviceFingerprint`
	- `browserFingerprint`
- Persisted IDs via localStorage + cookie fallback
- Stabilized metadata sending with hidden-page guard + `sendBeacon` fallback

#### `push-server/server.js`
- Added canonical device resolution on metadata upsert:
	- Match by `deviceId`
	- Match by `browserId`
	- Match by `deviceFingerprint`
- Added startup dedupe migration for historical duplicate metadata
- Added metadata/archive handling during dedupe

### Dashboard Security Hardening

#### `push-server/server.js`
- Added WireGuard/local IP guard middleware for admin endpoints:
	- `GET /dashboard`
	- `GET /api/logs/mobile`
	- `GET /api/logs/mobile/:deviceId`
	- `GET /api/logs/mobile/:deviceId/:filename`
	- `PATCH /api/logs/mobile/:deviceId/comment`

#### `nginx/phone.srve.cc.conf`
- Public dashboard route now blocked for internet clients
- Added WireGuard-only admin endpoint:
	- `http://10.252.253.15:8081/dashboard`
	- `http://10.252.253.15:8081/api/logs/mobile...`

### Browser Compatibility Fixes

#### `www/app/registration/primary.js`
- Fixed Brave import mismatch by importing `setRegistrationComplete` directly from `incoming/handlers.js`

#### `www/manifest.json`
- Removed missing icon references that produced 404 warnings
- Switched manifest icon references to existing `favicon.ico`

---

## Status: WORKING ✅
- [x] Android WebRTC logout fixed
- [x] iPhone ringing during login fixed
- [x] iPhone ringing after login fixed
- [x] Syntax error fixed
- [x] Dashboard visible only via WireGuard/local path
- [x] Metadata-only devices appear in dashboard
- [x] Device identity no longer random on every hard reload
- [x] Frontend index split into activity-based modules
