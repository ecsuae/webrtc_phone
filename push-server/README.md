# Push Notification Server for WebRTC Incoming Calls

Node.js server that handles push notifications for incoming WebRTC calls.

## Features

- Store push subscriptions per extension
- Send push notifications when calls arrive
- VAPID key generation
- REST API for subscription management
- Integration ready for FreeSWITCH/Kamailio

## Project Structure

The server is now organized by activity so each concern is isolated and easier to maintain.

```text
push-server/
  server.js                         # Thin bootstrap: wiring + startup + shutdown
  src/
    config.js                       # Env/config loading and defaults
    middleware/
      accessControl.js              # Client IP normalization + WireGuard/local guards
    routes/
      pushRoutes.js                 # /api/push/* subscribe/unsubscribe/notify
      logRoutes.js                  # /api/logs/* metadata ingest + admin APIs
      systemRoutes.js               # /health and /dashboard
    services/
      push/
        subscriptionStore.js        # In-memory subscription operations
      metadata/
        core.js                     # Metadata read/write + canonical identity helpers
        metadataUpdate.js           # Metadata patch/merge logic
        dedupe.js                   # Startup migration/deduplication pass
```

### Route Ownership

- `src/routes/pushRoutes.js`: push subscription and notify APIs.
- `src/routes/logRoutes.js`: metadata ingest and admin log/device APIs.
- `src/routes/systemRoutes.js`: health and dashboard serving.

### Security Model

- Public endpoints remain available for clients:
  - `POST /api/logs/mobile/metadata`
  - Push endpoints used by clients/integrations.
- Admin endpoints are WireGuard/local-only via `accessControl` middleware:
  - `GET /dashboard`
  - `GET /api/logs/mobile`
  - `PATCH /api/logs/mobile/comment`

## Installation

```bash
cd /opt/webrtc-sbc/push-server
npm install
```

## Setup

1. Generate VAPID keys:
```bash
npm run generate-keys
```

2. Copy the generated public key to `www/app/push.js`:
```javascript
const VAPID_PUBLIC_KEY = 'YOUR_GENERATED_PUBLIC_KEY';
```

3. Update `.env` with your details:
```bash
VAPID_PUBLIC_KEY=<from generate-keys>
VAPID_PRIVATE_KEY=<from generate-keys>
VAPID_SUBJECT=mailto:admin@srve.cc
PORT=3001
```

4. Start server:
```bash
npm start
```

## API Endpoints

### Subscribe to Push
```bash
POST /api/push/subscribe
Content-Type: application/json

{
  "extension": "900900",
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Unsubscribe
```bash
POST /api/push/unsubscribe
Content-Type: application/json

{
  "extension": "900900",
  "endpoint": "https://..."
}
```

### Trigger Push Notification (for incoming call)
```bash
POST /api/push/notify
Content-Type: application/json

{
  "extension": "900900",
  "from": "045945060",
  "callId": "abc123",
  "title": "Incoming Call",
  "body": "From: 045945060"
}
```

## Integration with FreeSWITCH

Add to dialplan to trigger push notification:

```xml
<action application="set" data="push_url=http://localhost:3001/api/push/notify"/>
<action application="set" data="push_extension=${destination_number}"/>
<action application="set" data="push_from=${caller_id_number}"/>
<action application="curl" data="${push_url} post extension=${push_extension}&from=${push_from}&callId=${uuid}"/>
```

## Integration with Kamailio

Add to kamailio.cfg:

```kamailio
# In route[RELAY] before relaying to WebRTC client
if ($proto == "ws" || $proto == "wss") {
    $var(push_url) = "http://localhost:3001/api/push/notify";
    $var(push_body) = "extension=" + $rU + "&from=" + $fU + "&callId=" + $ci;
    http_client_query($var(push_url), "$var(push_body)", "$var(push_result)");
}
```

## Testing

Test notification:
```bash
curl -X POST http://localhost:3001/api/push/notify \
  -H "Content-Type: application/json" \
  -d '{
    "extension": "900900",
    "from": "TEST",
    "callId": "test123",
    "title": "Test Call",
    "body": "This is a test notification"
  }'
```
