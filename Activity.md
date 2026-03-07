# Activity Log

## Latest Updates

| Date       | Time | Activity |
|------------|------|----------|
| 07-03-2026 | 10:35 | Refactored `push-server/dashboard.html` (monolithic 300+ lines) into modular structure: extracted CSS to `src/dashboard/styles.css` (192 lines), JavaScript to `src/dashboard/dashboard.js` (145 lines), and simplified HTML to clean 48-line template |
| 07-03-2026 | 10:30 | Refactored `www/app/remoteLogs.js` (411 lines) into modular `remoteLogs/` with activity-based split: `state.js`, `identity.js`, `transport.js`, `service.js` |
| 07-03-2026 | 10:20 | Completed post-refactor endpoint verification for split `push-server/server.js`; all routes confirmed working, security guards intact |
| 07-03-2026 | 10:15 | Added architecture documentation to `push-server/README.md` describing modular route/service/middleware layout |
| 07-03-2026 | 10:00 | Rebuilt and restarted push-server after modular split; no container errors |
| 07-03-2026 | 09:45 | Successfully split monolithic `push-server/server.js` (1275 lines) into modular `src/` structure (config, middleware, routes, services) |
| 07-03-2026 | 09:20 | Updated project docs (Activity/Changes/Structure) with dashboard security, fingerprint identity, and frontend modular split |
| 07-03-2026 | 09:15 | Restricted dashboard/admin logs to WireGuard-only access and added WG endpoint `http://10.252.253.15:8081/dashboard` |
| 07-03-2026 | 09:05 | Added server-side device identity resolution (`browserId` + `deviceFingerprint`) and startup dedupe migration for historical metadata |
| 07-03-2026 | 08:55 | Refactored `www/index.html` (924 lines) into modular layout/style/page boot files with activity-based split |
| 07-03-2026 | 08:40 | Fixed Brave runtime import issue (`setRegistrationComplete`) and manifest icon 404 warnings |
| 07-03-2026 | 08:30 | Stabilized remote metadata logging for Safari/iOS using visibility checks and `sendBeacon` fallback |
| 07-03-2026 | 11:10 | Fixed iPhone post-login ringing - added 3-second registration-complete grace period |
| 07-03-2026 | 11:05 | Fixed iPhone ringing during login - rejects all calls until registered |
| 07-03-2026 | 10:50 | Fixed syntax error in main.js preventing login |
| 07-03-2026 | 10:45 | Fixed Android WebRTC logout + iPhone phantom ringing with keepalive & grace period |

---

## Summary
- **Platform Stability**: Android/iOS registration and incoming-call gating fixes are active.
- **Observability**: Remote metadata/log capture with dashboard is active.
- **Security**: Dashboard/admin APIs are WireGuard-only.
- **Frontend Maintainability**: `index.html` and `remoteLogs.js` split into modular files by activity.
- **Backend Maintainability**: `push-server/server.js` split into modular route/service/middleware structure.
