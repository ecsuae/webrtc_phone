# 06 — Phase: Push Notifications
_Derived from actual code. Update when push or mobile recovery logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working (Desktop, Android, iOS)

---

## Scope of this phase

- Web Push API subscription lifecycle
- Service Worker push event handling
- Mobile client wake + re-registration flow
- Platform-specific push support and limitations
- VAPID key management
- Push server subscription storage and notify endpoint

---

## Key files

| File | Role |
|---|---|
| `www/sw.js` | Service Worker: receives push events, shows notifications, wakes clients |
| `www/app/push/support.js` | `isPushSupported()`, `registerServiceWorker()`, `requestNotificationPermission()` |
| `www/app/push/subscription.js` | `subscribeToPush()`, `unsubscribeFromPush()`, `subscribeAfterRegister()` |
| `www/app/push/constants.js` | VAPID key utilities, `urlBase64ToUint8Array()` |
| `www/app/push/recoverySession.js` | `saveSessionPassword()`, `getSessionPassword()` for re-registration |
| `www/app/push/installShortcut.js` | PWA home screen install prompts |
| `www/app/runtime/swWakeHandler.js` | SW message listener — triggers re-registration on wake |
| `www/app/runtime/mobileRecovery.js` | `startAndRegister()` — re-register after push wake |
| `www/app/runtime/desktop/pushDesktop.js` | Desktop push init |
| `www/app/runtime/ios/pushIos.js` | iOS push init |
| `www/app/runtime/android/pushAndroid.js` | Android push init |
| `push-server/src/routes/pushRoutes.js` | Backend: subscribe, unsubscribe, notify |
| `push-server/src/services/push/subscriptionStore.js` | In-memory subscription storage |

---

## System overview

```
Frontend (browser)          Service Worker           Push Server           Kamailio/PBX
     |                           |                        |                     |
     | registerServiceWorker()   |                        |                     |
     |-------------------------->|                        |                     |
     |                           |                        |                     |
     | subscribeToPush(ext)      |                        |                     |
     |---- PushManager.subscribe() -----> browser push endpoint                 |
     |                                                    |                     |
     | POST /api/push/subscribe {extension, subscription} |                     |
     |-------------------------------------------------->|                     |
     |                                                    |  stored in memory   |
     |                                                    |                     |
     |                         Incoming call arrives      |<-- INVITE from PBX  |
     |                                                    |<-- POST /notify {ext}|
     |                         webpush.sendNotification() |                     |
     |                                                    |                     |
     |                     [push event]                   |                     |
     |<--------------------------|                        |                     |
     |   postMessage(wakeup)     |                        |                     |
     |<--------------------------|                        |                     |
     |   showNotification(Answer/Reject)                  |                     |
     |                           |                        |                     |
     |   swWakeHandler receives postMessage               |                     |
     |   → startAndRegister()                             |                     |
     |   → REGISTER → registered                         |                     |
     |   → INVITE arrives → handleIncomingCallIsolated()  |                     |
     |                                                    |                     |
     |   User taps Answer in notification                 |                     |
     |<--------------------------|                        |                     |
     |   postMessage(action=answer)                       |                     |
     |   → answerIncomingCallIsolated()                   |                     |
```

---

## Service Worker (www/sw.js)

### push event handler

```js
self.addEventListener('push', (event) => {
  const payload = event.data.json();
  // { title, body, from, callId, url, timestamp }

  const wakeClients = self.clients.matchAll({ type: 'window' })
    .then(clients => clients.forEach(c =>
      c.postMessage({ type: 'incoming-call-action', action: 'wakeup', from, callId })
    ));

  const showNotification = self.registration.showNotification(payload.title, {
    body: payload.body,
    data: { from, callId, url },
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'reject', title: 'Reject' }
    ],
    requireInteraction: true,   // stays until user acts
  });

  // IMPORTANT: wake clients BEFORE showNotification
  event.waitUntil(Promise.all([wakeClients, showNotification]));
});
```

**Wake-before-notify order is critical.** Clients must be woken first so they can process the `wakeup` message and attempt re-registration before the user taps Answer.

### notificationclick event handler

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action } = event;
  const { from, callId, url } = event.notification.data;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const target = clients.find(c => c.focused) || clients[0];
      if (!target) return self.clients.openWindow(url);

      target.focus();
      // 1500ms delay — cold-start page needs time to load before postMessage
      return new Promise(resolve => setTimeout(() => {
        target.postMessage({ type: 'incoming-call-action', action, from, callId });
        resolve();
      }, 1500));
    })
  );
});
```

The 1500ms delay is a reliability fix for cold-start (app was not open). Removing it causes the message to arrive before the app is ready to handle it.

---

## Push subscription lifecycle

**File:** `www/app/push/subscription.js`

### subscribeToPush(extension)

```
1. isPushSupported() && Notification.permission === 'granted'
2. reg = await navigator.serviceWorker.ready
3. existing = await reg.pushManager.getSubscription()
4. if !existing:
   sub = await reg.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
   })
5. POST /api/push/subscribe { extension, subscription: sub.toJSON() }
6. Store in localStorage
7. pushEnabled = true
```

### subscribeAfterRegister(extension)

Silent subscribe — used after login if permission already granted. Does not prompt the user. Called from platform-specific registration bootstraps.

### unsubscribeFromPush(extension)

```
1. POST /api/push/unsubscribe { extension }
2. sub.unsubscribe()
3. Clear localStorage state
```

---

## Mobile recovery — swWakeHandler.js

**File:** `www/app/runtime/swWakeHandler.js`

Listens for `incoming-call-action` postMessages from the SW.

```js
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type !== 'incoming-call-action') return;

  if (event.data.action === 'wakeup') {
    if (!st.registered && !st.registering) {
      startAndRegister(SIP, st, ui);  // re-register so INVITE can arrive
    }
  }

  if (event.data.action === 'answer') {
    answerIncomingCallIsolated(SIP, st, ui);
  }

  if (event.data.action === 'reject') {
    rejectIncomingCallIsolated(st, ui);
  }
});
```

**File:** `www/app/runtime/mobileRecovery.js` — `startAndRegister(SIP, st, ui)`:
1. Loads saved credentials from `push/recoverySession.js`
2. Calls `startPrimaryRegistration(SIP, st, ui)` with recovered credentials
3. UI stays in "recovering" state until registration completes

---

## Platform-specific push support

### Desktop
- `Notification` API + SW available in all modern browsers
- No extra requirements
- `pushDesktop.js`: registers SW, requests permission, subscribes

### Android PWA
- Must be added to home screen for reliable push
- In-browser (not installed) push is inconsistent on Android Chrome
- `wakeLockManager.js` acquires screen wake lock during calls to prevent sleep
- `pushAndroid.js`: same flow as desktop + wake lock integration

### iOS PWA
- **Requires iOS 16.4+ and Safari**
- **Must be installed as home screen app** — browser tab does NOT receive push on iOS
- Chrome on iOS is blocked from push (Apple restriction) — `isPushSupported()` returns false for Chrome iOS
- `pushIos.js`: shows install instructions if not in standalone mode

### Detecting standalone mode

`window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone === true` (iOS Safari).

`isPushSupported()` in `push/support.js` checks this and returns false for iOS non-standalone.

---

## VAPID key management

VAPID keys are configured in `.env`:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@domain.com
```

The public key is served to the frontend via `GET /api/push/vapid-public-key` and also injected into `index.html` via template (for use in SW subscription).

The private key never leaves the push server.

`push/constants.js` — `urlBase64ToUint8Array(base64)` converts the public key to `Uint8Array` for `PushManager.subscribe`.

---

## Push server backend

**File:** `push-server/src/routes/pushRoutes.js`

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/push/subscribe` | None | Store `{extension, subscription}` in memory |
| `POST /api/push/unsubscribe` | None | Remove by extension + endpoint |
| `POST /api/push/notify` | Internal only | Send push to all subscriptions for extension |
| `GET /api/push/vapid-public-key` | None | Return VAPID public key |
| `GET /api/push/subscriptions` | WireGuard | Admin: list all subscriptions |

**`/notify` request body:**
```json
{
  "extension": "1001",
  "payload": {
    "title": "Incoming call",
    "body": "From: John Doe",
    "from": "John Doe",
    "callId": "abc-123",
    "url": "https://phone.domain.com"
  }
}
```

**Kamailio calls `POST http://127.0.0.1:3001/api/push/notify`** when routing an INVITE to an offline client.

### Known issue: subscriptions are in-memory only

`subscriptionStore.js` stores subscriptions in a JS `Map`. On push-server restart, all subscriptions are lost. Users must reload the app to re-subscribe.

**Fix needed:** Persist to flat file (JSON) or Redis.

---

## Debugging

| Symptom | Check |
|---|---|
| Push not arriving | VAPID keys match `.env`, push-server `/api/push/subscriptions`, browser push permission |
| SW not registering | SW file path `/sw.js`, HTTPS required, browser support |
| iOS push not working | Not installed as home screen app, iOS < 16.4, Chrome on iOS |
| Android push unreliable | Not installed as home screen app |
| `wakeup` message not received | `swWakeHandler.js` listener, SW state (active vs waiting) |
| Answer/reject from notification does nothing | 1500ms delay in SW notificationclick, `postMessage` not reaching client |
| Push subscription lost after server restart | In-memory store — known issue, see above |
| Re-registration fails after wake | `push/recoverySession.js` credential retrieval, `startAndRegister()` logic |
