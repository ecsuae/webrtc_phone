# Activity Log

## Latest Updates

| Date       | Time | Activity |
|------------|------|----------|
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
- **Frontend Maintainability**: `index.html` split into modular files by activity.
