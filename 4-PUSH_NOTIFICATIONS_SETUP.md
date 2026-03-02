# Incoming Call Push Notifications - Complete Setup Guide

## Overview

This solution enables your WebRTC phone to receive incoming call notifications even when the browser tab is closed or inactive.

**Architecture:**
```
Incoming Call → PBX → Kamailio → Push Server → Browser Notification → Auto-open WebRTC App
```

**Supported Platforms:**
- ✅ Desktop: Chrome, Firefox, Edge
- ✅ Android: Chrome, Firefox
- ⚠️  iOS Safari: Requires iOS 16.4+ and PWA installation (limited support)

---

## Quick Start (5 Steps)

### Step 1: Install Push Server

```bash
cd /opt/webrtc-sbc/push-server
npm install
```

### Step 2: Generate VAPID Keys

```bash
npm run generate-keys
```

This outputs keys like:
```
Public Key: BNx7U...
Private Key: xyz...
```

### Step 3: Configure Push Server

```bash
cp .env.example .env
nano .env
```

Paste the generated keys:
```env
VAPID_PUBLIC_KEY=BNx7U...
VAPID_PRIVATE_KEY=xyz...
VAPID_SUBJECT=mailto:admin@srve.cc
PORT=3001
```

### Step 4: Update Web App

Edit `/opt/webrtc-sbc/www/app/push.js`:

```javascript
const VAPID_PUBLIC_KEY = 'BNx7U...';  // Paste your public key here
```

### Step 5: Start Push Server

```bash
# Production
npm start

# Or run in background with PM2
npm install -g pm2
pm2 start server.js --name webrtc-push
pm2 save
pm2 startup  # Enable auto-start on boot
```

---

## Web App Integration

### Update HTML

Add to `/opt/webrtc-sbc/www/index.html` in the `<head>` section:

```html
<head>
  <!-- Existing meta tags... -->
  
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json">
  
  <!-- PWA Theme -->
  <meta name="theme-color" content="#2196F3">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="WebPhone">
  
  <!-- Icons -->
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="apple-touch-icon" href="/icon-192.png">
</head>
```

### Update Main App

Edit `/opt/webrtc-sbc/www/app/main.js` to add push notification support:

```javascript
import { 
  registerServiceWorker, 
  subscribeToPush, 
  unsubscribeFromPush,
  setupServiceWorkerListener,
  isPushSupported,
  getPushStatus
} from "./push.js";

// Initialize service worker and push notifications
async function initializePush() {
  if (!isPushSupported()) {
    console.log('Push notifications not supported on this browser');
    return;
  }

  // Register service worker
  await registerServiceWorker();
  
  // Setup listener for incoming call actions
  setupServiceWorkerListener((data) => {
    console.log('Incoming call action:', data);
    
    if (data.action === 'answer') {
      // Auto-connect WebSocket and prepare to answer
      if (!st.registered && ui.ext()) {
        startAndRegister(SIP, st, ui);
      }
    } else if (data.action === 'reject') {
      // Could send rejection to PBX here
      console.log('Call rejected');
    }
  });
}

// Call this on page load
initializePush();

// Subscribe to push when registering
async function startAndRegisterWithPush(SIP, st, ui) {
  // Original registration
  await startAndRegister(SIP, st, ui);
  
  // Subscribe to push after successful registration
  if (st.registered && isPushSupported()) {
    const extension = ui.ext();
    await subscribeToPush(extension);
  }
}

// Unsubscribe when unregistering
async function stopAndUnregisterWithPush(st, ui, disconnect) {
  const extension = ui.ext();
  
  // Unsubscribe from push first
  if (isPushSupported()) {
    await unsubscribeFromPush(extension);
  }
  
  // Original unregistration
  await stopAndUnregister(st, ui, disconnect);
}
```

---

## Nginx Configuration (Reverse Proxy)

Add to `/opt/webrtc-sbc/nginx/phone.srve.cc.conf`:

```nginx
# Push Server API proxy
location /api/push/ {
    proxy_pass http://127.0.0.1:3001/api/push/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Service Worker (must be served from root with correct MIME type)
location = /sw.js {
    alias /var/www/phone/sw.js;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Service-Worker-Allowed "/";
    types {
        application/javascript js;
    }
}

# Manifest
location = /manifest.json {
    alias /var/www/phone/manifest.json;
    add_header Cache-Control "public, max-age=604800";
}
```

Restart Nginx:
```bash
docker restart phone-nginx
```

---

## Kamailio Integration (Trigger Notifications)

Add to `/opt/webrtc-sbc/kamailio/kamailio.cfg`:

### Option 1: Using http_client module

Load module:
```kamailio
loadmodule "http_client.so"
```

Add route for incoming calls to WebRTC clients:
```kamailio
route[TO_WEBRTC_CLIENT] {
    xlog("L_INFO", "Incoming call to WebRTC client $rU from $fU\n");
    
    # Trigger push notification
    $var(push_url) = "http://127.0.0.1:3001/api/push/notify";
    $var(push_json) = '{"extension":"' + $rU + '","from":"' + $fU + '","callId":"' + $ci + '"}';
    
    http_client_query($var(push_url), $var(push_json), "$var(push_result)");
    xlog("L_INFO", "Push notification result: $var(push_result)\n");
    
    # Continue with normal call routing
    t_on_failure("PUSH_TIMEOUT");
    route(RELAY);
}

failure_route[PUSH_TIMEOUT] {
    # If client doesn't answer after push, could implement fallback logic
    xlog("L_INFO", "Call not answered after push notification\n");
}
```

### Option 2: Using exec module (simpler)

```kamailio
loadmodule "exec.so"

route[TO_WEBRTC_CLIENT] {
    # Trigger push via curl
    $var(push_cmd) = "curl -s -X POST http://127.0.0.1:3001/api/push/notify -H 'Content-Type: application/json' -d '{\"extension\":\"" + $rU + "\",\"from\":\"" + $fU + "\",\"callId\":\"" + $ci + "\"}' &";
    exec_msg($var(push_cmd));
    
    route(RELAY);
}
```

---

## FreeSWITCH Integration

### Method 1: Dialplan (XML)

Add to dialplan before bridging to WebRTC extension:

```xml
<extension name="webrtc_incoming_push">
  <condition field="destination_number" expression="^(900900)$">
    <!-- Trigger push notification -->
    <action application="set" data="push_url=http://127.0.0.1:3001/api/push/notify"/>
    <action application="set" data="push_data=extension=${destination_number}&from=${caller_id_number}&callId=${uuid}"/>
    <action application="curl" data="${push_url} post ${push_data}"/>
    
    <!-- Continue with normal bridge -->
    <action application="bridge" data="user/${destination_number}@${domain_name}"/>
  </condition>
</extension>
```

### Method 2: Lua Script

Create `/usr/share/freeswitch/scripts/push_notify.lua`:

```lua
local http = require("socket.http")
local json = require("json")

function push_notify(extension, from, call_id)
    local push_url = "http://127.0.0.1:3001/api/push/notify"
    
    local payload = json.encode({
        extension = extension,
        from = from,
        callId = call_id
    })
    
    local response, status = http.request(push_url, payload)
    freeswitch.consoleLog("INFO", "Push notification sent: " .. tostring(status))
end

-- Usage in dialplan
-- <action application="lua" data="push_notify.lua ${destination_number} ${caller_id_number} ${uuid}"/>
```

---

## Testing

### 1. Test Push Server

```bash
# Check server health
curl http://localhost:3001/health

# Expected: {"status":"ok","subscriptions":0,"vapidConfigured":true}
```

### 2. Test Web App Registration

1. Open browser to https://phone.srve.cc
2. Open DevTools Console (F12)
3. Register with your extension
4. Check console for:
   - `[Push] Service worker registered`
   - `[Push] Push subscription created`
   - `[Push] Subscription registered with server`

### 3. Test Push Notification Manually

```bash
# Replace extension with your registered extension
curl -X POST http://localhost:3001/api/push/notify \
  -H "Content-Type: application/json" \
  -d '{
    "extension": "900900",
    "from": "TEST_CALLER",
    "callId": "test123",
    "title": "Test Incoming Call",
    "body": "This is a test notification"
  }'
```

You should see a browser notification popup!

### 4. Test Real Incoming Call

1. Close browser tab (or minimize)
2. Call your WebRTC extension from another phone
3. You should receive a notification
4. Click "Answer" on the notification
5. Browser opens and call connects

---

## Troubleshooting

### Push Notifications Not Working

**Check browser support:**
```javascript
// In browser console
console.log('ServiceWorker:', 'serviceWorker' in navigator);
console.log('PushManager:', 'PushManager' in window);
console.log('Notification:', 'Notification' in window);
console.log('Permission:', Notification.permission);
```

**Check service worker:**
- Chrome: `chrome://serviceworker-internals/`
- Firefox: `about:debugging#/runtime/this-firefox`

**Check subscription:**
```bash
curl http://localhost:3001/api/push/subscriptions
```

### iOS Safari Issues

iOS Safari has limited Web Push support:
- Requires iOS 16.4 or later
- Only works with installed PWA (not in browser)
- User must "Add to Home Screen"

**Solution for iOS:**
Consider building a native iOS app wrapper or use a hybrid approach (Capacitor/Cordova).

### Permission Denied

If user denied notification permission:
- User must manually enable in browser settings
- Chrome: Settings → Privacy → Site Settings → Notifications
- Firefox: Preferences → Privacy & Security → Permissions → Notifications

---

## Production Deployment

### 1. Run Push Server with PM2

```bash
cd /opt/webrtc-sbc/push-server
pm2 start server.js --name webrtc-push
pm2 save
pm2 startup
```

### 2. Enable HTTPS (Required for Service Workers)

Service workers only work on HTTPS (or localhost). Ensure your site is served over HTTPS (already configured with your Nginx + Let's Encrypt setup).

### 3. Add Icons

Create PWA icons in `/opt/webrtc-sbc/www/`:
- icon-72.png, icon-96.png, icon-128.png, icon-144.png
- icon-152.png, icon-192.png, icon-384.png, icon-512.png
- badge-72.png (for notification badge)

Simple way to generate:
```bash
# Install ImageMagick
apt-get install imagemagick

# Create a base 512x512 icon, then resize
convert icon-512.png -resize 192x192 icon-192.png
convert icon-512.png -resize 144x144 icon-144.png
# etc...
```

### 4. Monitor Push Server

```bash
# View logs
pm2 logs webrtc-push

# Monitor performance
pm2 monit

# Check status
pm2 status
```

---

## Security Considerations

1. **VAPID Keys**: Keep private key secret, never expose in client code
2. **Authentication**: Add API authentication for production
3. **Rate Limiting**: Prevent abuse of push notification API
4. **HTTPS**: Always use HTTPS in production
5. **Subscription Validation**: Validate extensions before storing

---

## Next Steps

1. ✅ Set up push server
2. ✅ Configure web app
3. ✅ Test notifications
4. ✅ Integrate with Kamailio/FreeSWITCH
5. 📱 Test on mobile devices
6. 🎨 Customize notification UI
7. 📊 Add analytics/monitoring

---

## Summary

You now have a complete push notification system:
- **Web App**: Service worker + push subscription
- **Push Server**: Handles notification delivery
- **Integration**: Kamailio/FreeSWITCH triggers notifications
- **Result**: Incoming calls work even when tab is closed!

**Test thoroughly on all target platforms before production deployment.**
