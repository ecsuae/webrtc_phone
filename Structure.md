# WebRTC SBC Project Structure

## Project Overview
WebRTC-based SIP calling application with push notifications, multi-domain support, and mobile optimization. Server-side components: Kamailio (SIP), RTPEngine (media), CoTURN (STUN/TURN), Nginx (reverse proxy). Client-side: SPA with SIP.js, WebRTC, Service Workers.

## Latest Architecture Notes (07-03-2026)
- `index.html` is now a thin shell; layout/styles/page behavior are split into small activity-based files.
- Mobile debug dashboard and admin log APIs are restricted to WireGuard/local access.
- Device identity now includes stable browser/device fingerprints to reduce duplicate records.
- Push server runs startup metadata dedupe migration for historical duplicates.

---

## Frontend Project Structure (`/www`)

### Root Level Files

| File | Purpose |
|------|---------|
| **index.html** | Thin app shell: mounts `#appRoot`, loads SIP.js, and bootstraps modular page modules |
| **app.js** | Express server serving static files and push notification API routes |
| **config.js** | Environment configuration (domains, WSS servers, ICE servers) |
| **phone.css** | Global styles for app layout, animations, responsive design |
| **sw.js** | Service Worker for push notifications and offline functionality |
| **manifest.json** | PWA manifest for app installation |

### `/styles` - Activity-based Stylesheets

| File | Purpose |
|------|---------|
| **index.css** | CSS aggregator importing all style modules |
| **theme.css** | Theme variables, base layout, status bar, cards, shared primitives |
| **forms-buttons.css** | Form controls, buttons, refresh/debug icon styles |
| **dialpad-tabs.css** | Dial pad, call action buttons, tabs |
| **history-log-responsive.css** | History list, log panel, responsive media rules |

### `/app/layout` - Activity-based UI Sections

| File | Purpose |
|------|---------|
| **headerSection.js** | Renders app header |
| **statusBarSection.js** | Renders status row and top action buttons |
| **registrationSection.js** | Renders account/login card |
| **dialpadSection.js** | Renders dial/history tabs and call controls |
| **logSection.js** | Renders debug log panel and remote audio element |
| **renderAppLayout.js** | Composes layout sections into `#appRoot` |

### `/app/page` - Page Boot & Browser Actions

| File | Purpose |
|------|---------|
| **bootstrapPage.js** | Page bootstrap sequence (render + init + import main app) |
| **dialpadInput.js** | Dialpad click/keyboard input behavior |
| **cacheActions.js** | Hard reload + cache clear behavior |
| **debugToggleUi.js** | Debug icon state and toggle UX |

---

### `/app` - Core Application Logic

#### Core Files

| File | Exports | Purpose |
|------|---------|---------|
| **main.js** | Event listeners, Wake Lock, Screen recovery | Application entry point; registers event listeners for UI buttons; manages Wake Lock API for Android; handles screen lock/unlock recovery |
| **config.js** | Constants, ICE servers, codec settings | Global configuration: VAPID key, G.711 codec forcing, RTP relay, password masking settings |
| **dom.js** | `el`, `$`, helper functions | DOM selectors and utilities for input fields, form parsing, WSS normalization |
| **log.js** | `logLine()`, `formatSipResponse()`, `bootLog()` | Logging to textarea element; application startup log |
| **remoteLogs.js** | Metadata/log capture + fingerprint identity (re-export entrypoint) | Thin re-export file; composes modular `remoteLogs/` services; maintains backward API compatibility |
| **media.js** | Audio stream management | Microphone access, audio constraints (G.711), local stream handling |
| **sdp.js** | `g711OnlyModifier()` | SDP codec filtering to enforce G.711 only |
| **pcDebug.js** | Exports from `pc/bind.js` | PeerConnection debugging utilities |
| **push.js** | Push subsystem exports | Main push notification module exports |
| **sipRegister.js** | `startAndRegister()`, `stopAndUnregister()`, `createAppState()` | Registration orchestration; calls primary registration, manages state |
| **sipCall.js** | `startCall()`, `hangupCall()` | Outgoing call orchestration; exports re-exported for compatibility |
| **sipCallIncoming.js** | Incoming call handlers | Compatibility layer exporting incoming call logic |

---

#### `/app/registration` - SIP Registration

| File | Exports | Purpose |
|------|---------|---------|
| **state.js** | `createAppState()` | App state object: `ua`, `reg`, `registered`, `registering`, `session`, `incomingInvitation`, `_reregTimer` |
| **primary.js** | `startPrimaryRegistration()` | Registrar with primary domain; builds UserAgent with aggressive keepalive (20s), periodic re-registration (2.5min), Wake Lock cleanup on shutdown |
| **secondary.js** | `registerWithSBC()`, `stopSecondaryRegistration()` | Secondary SBC registration (disabled); fallback mechanism |

**Key Functions**:
- `startPeriodicReregistration()` (primary.js) - Re-registers every 150s for Android background persistence
- `attachTransportListener()` (primary.js) - Auto-registers on transport reconnection
- `buildUserAgent()` (primary.js) - Configures SIP.js UserAgent with ICE servers, transport options

---

#### `/app/incoming` - Incoming Call Control

| File | Exports | Purpose |
|------|---------|---------|
| **handlers.js** | `handleIncomingCallIsolated()`, `answerIncomingCallIsolated()`, `rejectIncomingCallIsolated()` | Incoming call logic: displays alert, manages session state, attaches media |
| **alert.js** | `startIncomingAlert()`, `stopIncomingAlert()`, `primeIncomingRingtone()`, `focusDialTabForIncoming()` | Ringtone playback (prevents ghost calls in first 2s), vibration, banner, CSS animations |
| **media.js** | `attachIncomingRemoteAudio()`, `startIncomingEarlyMediaLoop()` | Audio playback for incoming calls; early media attachment |

**Key Features**:
- Ghost call prevention: 2-second grace period after page load
- Audio priming with explicit loop=false enforcement
- Ringtone banner with Answer/Reject buttons

---

#### `/app/outgoing` - Outgoing Call Control

| File | Exports | Purpose |
|------|---------|---------|
| **call.js** | `startCall()`, `hangupCall()` | Outgoing call initiation and termination; SDP modifiers for G.711 |
| **media.js** | `attachRemoteAudio()`, `startEarlyMediaAttachLoop()`, `clearEarlyMediaAttachLoop()` | Remote audio handling; early media loop for ringing detection |
| **ringback.js** | `primeOutboundRingbackContext()`, `startRingbackTone()`, `stopRingbackTone()`, `startOutboundRingbackIfNeeded()` | Ringback tone playback during outgoing calls |

**Key Features**:
- Early media detection and ringback tone
- Audio state transitions during call setup

---

#### `/app/push` - Push Notifications

| File | Exports | Purpose |
|------|---------|---------|
| **subscription.js** | `subscribeToPush()`, `unsubscribeFromPush()`, `subscribeAfterRegister()`, `getPushStatus()` | Push subscription management; retries for iOS; status queries |
| **support.js** | `isPushSupported()`, `registerServiceWorker()`, `requestNotificationPermission()`, `setupServiceWorkerListener()`, `testPushNotification()` | Service Worker registration, permission request, cleanup |
| **constants.js** | `VAPID_PUBLIC_KEY`, `urlBase64ToUint8Array()` | VAPID public key for Web Push; base64 encoding utilities |

**Key Features**:
- 3-retry subscription for iOS reliability
- Service Worker message listener for incoming call actions
- Graceful permission fallback

---

#### `/app/remoteLogs` - Remote Logging (Activity-based Modules)

| File | Exports | Purpose |
|------|---------|------|
| **state.js** | `state`, constants | Global state: buffers, timers, debug flag, identity fields, lifecycle tracking |
| **identity.js** | `getOrCreateDeviceId()`, `getUsernameHistory()`, `getDeviceInfo()`, helpers | Device/browser fingerprinting; persistent ID generation; user history |
| **transport.js** | `sendMetadataToServer()`, `sendLogsToServer()`, `pageIsVisible()`, `trySendMetadataBeacon()` | HTTP fetch/beacon operations; visibility-based send guards; error handling |
| **service.js** | `startRemoteLogging()`, `toggleDebugMode()`, `setUsername()`, `captureLog()`, `isDebugMode()`, `getLogBuffer()`, `getInfo()` | Service orchestration; lifecycle event binding; debug mode toggle; timer management |

**Key Architecture**:
- Modular split by concern: state, identity, transport, service coordination
- `remoteLogs.js` re-exports all public functions for backward compatibility
- Each module under 130 lines, focused on single responsibility

---

#### `/app/ui` - User Interface

| File | Exports | Purpose |
|------|---------|---------|
| **appUi.js** | `createUi(st)` | Main UI object with getters/setters for extension, domain, password, dial output, status display, transport state, button visibility |
| **callControls.js** | `setupCallControls(st)` | Dial button animations, call control button styling |
| **callHistoryLocal.js** | `createCallHistory()` | localStorage-backed call history with auto-save (1min), persists across sessions |
| **callTimer.js** | `createCallTimer()` | Call duration timer with MM:SS formatting |
| **tabNavigation.js** | `setupTabNavigation()` | Tab switching (dial, logs, history, settings) with active state |

**Key Features**:
- Call history auto-save every 60 seconds
- Tab-based navigation with visual indicators
- Button state management based on registration status

---

#### `/app/pc` - PeerConnection Utilities

| File | Exports | Purpose |
|------|---------|---------|
| **bind.js** | `bindPeerConnection()` | Attaches PC event logging for debugging |
| **stats.js** | Stats collection | WebRTC stats monitoring (optional) |
| **utils.js** | Helper utilities | Common PC utilities |

---

#### `/app/vendor` - Third-party Libraries

| File | Purpose |
|------|---------|
| **sip.min.js** | SIP.js library (minified) - handles SIP protocol, INVITE, REGISTER, BYE messages |

---

## Server Components (Docker)

### Kamailio (`/kamailio`)
- **kamailio.cfg** - Main SIP routing configuration
- **local.cfg** - Local domain settings
- **tls.cfg** - TLS/SSL configuration
- **routes/** - Modularized SIP routing logic
  - `10-incoming.cfg` - Incoming call routing
  - `11-outgoing.cfg` - Outgoing call routing
  - `20-registration.cfg` - REGISTER request handling
  - `30-dialog-relay.cfg` - Dialog state relay
  - `40-replies.cfg` - Response handling
  - `50-domain-map.cfg` - Domain mapping logic
  - `60-media.cfg` - Media processing

### RTPEngine (`/rtpengine`)
- **rtpengine.conf** - Media relay configuration

### CoTURN (`/coturn`)
- **turnserver.conf** - STUN/TURN server settings

### Nginx (`/nginx`)
- **phone.srve.cc.conf** - Reverse proxy for WebRTC client

**Access Model**:
- Public dialer stays on `https://phone.srve.cc`.
- Dashboard/admin paths are restricted:
  - `https://phone.srve.cc/dashboard` (WireGuard/local only)
  - `http://10.252.253.15:8081/dashboard` (WireGuard interface endpoint)

### Push Server (`/push-server`)
- **server.js** - Node.js server for push notifications
- **package.json** - Dependencies

**Key Runtime Features**:
- Canonical metadata identity resolution (`deviceId` -> `browserId` -> `deviceFingerprint`)
- Startup dedupe migration for metadata + duplicate device log folders
- WireGuard/local-only guard middleware for dashboard/admin log endpoints

---

## Data File Structure

### `/backups` - Database Backups
Backup files for Kamailio database snapshots

### `/certs` - SSL/TLS Certificates
Self-signed or CA certificates for WSS and HTTPS

---

## Routing & Logic Summary

### SIP Call Flow

```
USER_ACTION
  ↓
main.js (event listener)
  ↓
startAndRegister() [sipRegister.js]
  ↓
startPrimaryRegistration() [primary.js]
  ├── buildUserAgent() - creates SIP.js UserAgent
  ├── attachTransportListener() - monitors WebSocket connection
  ├── startPeriodicReregistration() - Android persistence (2.5min)
  └── Registerer.register() - sends REGISTER to Kamailio
  
INCOMING_CALL:
  Kamailio routes INVITE → WebSocket → SIP.js → 
  onInvite delegate → handleIncomingCallIsolated() [handlers.js] →
  startIncomingAlert() [alert.js] + answerIncomingCallIsolated() [handlers.js]
  
OUTGOING_CALL:
  startCall() [call.js] → buildInviter() → INVITE to Kamailio →
  Kamailio routes to peer → RTPEngine bridge → Answer → 
  attachRemoteAudio() [media.js] → Play ringtone [ringback.js]
  
HANGUP:
  hangupCall() [call.js] → session.bye() → Kamailio cleanup
  
UNREGISTER:
  stopAndUnregister() [sipRegister.js] → 
  registerer.unregister() → stops UserAgent → 
  releases Wake Lock → cleanup timers
```

---

## Key Design Patterns

### 1. **Modular Organization**
- Core functionality split by feature (incoming, outgoing, registration, push)
- Thin compatibility layers (sipCall.js, sipCallIncoming.js) prevent circular imports

### 2. **State Management**
- Single app state object (st) passed through functions
- State includes: UserAgent, Registerer, active session, invitation, metrics

### 3. **Mobile Optimization**
- Wake Lock API prevents Android sleep
- Periodic re-registration for background persistence
- Screen lock recovery with gentle re-register fallback to restart
- Ghost call prevention with 2-second page load grace period

### 4. **Logging**
- Centralized logging to textarea (`log.js`)
- ISO timestamps for debugging
- Password masking for security

### 5. **Push Notifications**
- Service Worker in sw.js handles notifications when app closed
- Two-way messaging between app and SW
- Notification click triggers Answer/Reject actions

---

## Duplicate Detection & Code Reuse

### **NO DUPLICATES FOUND** ✓

**Unique Exports by Function**:
- Registration: `startAndRegister()`, `stopAndUnregister()`, `startPrimaryRegistration()`
- Incoming: `handleIncomingCallIsolated()`, `answerIncomingCallIsolated()`, `rejectIncomingCallIsolated()`
- Outgoing: `startCall()`, `hangupCall()`, `startRingbackTone()`, `stopRingbackTone()`
- UI: `createUi()`, `setupCallControls()`, `createCallHistory()`, `createCallTimer()`, `setupTabNavigation()`
- Push: `subscribeToPush()`, `unsubscribeFromPush()`, `registerServiceWorker()`

**Shared Utilities (Intentional)**: 
- `logLine()`, `nowISO()`, `getLocalStream()` - used across multiple modules for consistency
- No function implements the same logic in multiple places

### **Last Updated**: 07-03-2026 (modular split + fingerprint identity + WireGuard dashboard hardening)
