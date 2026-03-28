# Migration Guide: phone.srve.cc → phonex.srve.cc

## Quick Answer
**No, changing only the .env file is NOT sufficient.** You need to update 5 locations.

---

## Migration Checklist

### 1. ✅ Update `.env` File
**Location**: `/opt/webrtc-sbc/.env`

```bash
# OLD
DOMAIN=phone.srve.cc

# NEW
DOMAIN=phonex.srve.cc
PUBLIC_IP=<YOUR_NEW_SERVER_IP>
PBX_IP=testfusn.srve.cc  # Keep as-is (this is your PBX domain)
```

**What it affects**: Kamailio, coturn environment variable substitution

---

### 2. ✅ Create New Nginx Configuration File
**Current File**: `nginx/phone.srve.cc.conf`  
**New File**: `nginx/phonex.srve.cc.conf`

```bash
# Copy the existing config to new domain name
cd /opt/webrtc-sbc
cp nginx/phone.srve.cc.conf nginx/phonex.srve.cc.conf

# Edit the new file and change all occurrences of phone.srve.cc to phonex.srve.cc
sed -i 's/phone.srve.cc/phonex.srve.cc/g' nginx/phonex.srve.cc.conf
```

**What it affects**: Nginx reverse proxy hostname matching

---

### 3. ✅ Update `docker-compose.yml`
**Location**: `docker-compose.yml` line 87

```yaml
# OLD
nginx:
  volumes:
    - ./nginx/phone.srve.cc.conf:/etc/nginx/conf.d/default.conf:ro

# NEW
nginx:
  volumes:
    - ./nginx/phonex.srve.cc.conf:/etc/nginx/conf.d/default.conf:ro
```

**What it affects**: Which nginx config file is loaded in the container

---

### 4. ✅ Update Frontend Configuration (`www/app/config.js`)
**Location**: `www/app/config.js` line 23

```javascript
// OLD
export const TURN_HOST = "phone.srve.cc";

// NEW
export const TURN_HOST = "phonex.srve.cc";
```

**What it affects**: TURN/STUN server hostname for WebRTC ICE candidates

---

### 5. ✅ Update HTML Defaults (`www/index.html`)
**Location**: `www/index.html` lines 26, 48

```html
<!-- OLD -->
<body data-sip-domain="testfusn.srve.cc" data-wss-host="phone.srve.cc">
  ...
  <input id="wsshost" value="phone.srve.cc" />

<!-- NEW -->
<body data-sip-domain="testfusn.srve.cc" data-wss-host="phonex.srve.cc">
  ...
  <input id="wsshost" value="phonex.srve.cc" />
```

**What it affects**: Frontend WebSocket proxy hostname default values

---

## Step-by-Step Migration

### On Current Server (phone.srve.cc)
```bash
# 1. Make sure everything is committed
cd /opt/webrtc-sbc
git status
# You should see "nothing to commit, working tree clean"

# 2. Optional: Tag the current version
git tag -a v1.0-phone.srve.cc -m "Working version on phone.srve.cc"

# 3. Push to remote
git push origin main
git push origin --tags
```

### On New Server (phonex.srve.cc)
```bash
# 1. Clone the project
git clone <YOUR_REPO_URL> /opt/webrtc-sbc
cd /opt/webrtc-sbc

# 2. Update .env with new domain and IP
nano .env
# Change:
#   DOMAIN=phonex.srve.cc
#   PUBLIC_IP=<NEW_SERVER_IP>

# 3. Create nginx config for new domain
cp nginx/phone.srve.cc.conf nginx/phonex.srve.cc.conf
sed -i 's/phone.srve.cc/phonex.srve.cc/g' nginx/phonex.srve.cc.conf

# 4. Update docker-compose.yml
sed -i 's/phone.srve.cc.conf/phonex.srve.cc.conf/g' docker-compose.yml

# 5. Update www/app/config.js
sed -i 's/phone.srve.cc/phonex.srve.cc/g' www/app/config.js

# 6. Update www/index.html
sed -i 's/phone.srve.cc/phonex.srve.cc/g' www/index.html

# 7. Verify changes
git diff heads/main

# 8. Ensure certs directory exists and has valid certificates
ls -la certs/
# Should have: fullchain.pem, privkey.pem

# 9. Start services
docker-compose up -d

# 10. Test
docker-compose exec -T kamailio kamctl ul show
```

---

## Verification Checklist

After migration, verify:

```bash
# 1. Check Kamailio is running
docker-compose ps | grep kamailio
# Should show: Up

# 2. Test RPC interface
docker-compose exec -T kamailio kamctl ul show
# Should return JSON response (even if empty)

# 3. Check nginx config loaded correctly
docker-compose logs nginx | grep "phonex.srve.cc"

# 4. Test browser access
# Navigate to https://phonex.srve.cc
# Should show login page
# Check browser console (F12) for any domain-related errors

# 5. Check WebSocket connection
# Browser console should show:
# "WS SIP send/receive working"
```

---

## What These Variables Control

| Variable | Usage | Affects |
|----------|-------|---------|
| `DOMAIN` | .env | Kamailio realm, certificates, PBX communication |
| `TURN_HOST` | config.js, index.html | WebRTC ICE server, STUN/TURN endpoints |
| `WSS_HOST` | index.html | Frontend default WebSocket proxy server |
| `PUBLIC_IP` | docker-compose.yml | RTPEngine media interface, SIP signaling address |
| `PBX_IP` | .env (often testfusn.srve.cc) | Upstream PBX server - NO CHANGE for federation |

---

## Important Notes

⚠️ **Do NOT change**:
- `PBX_IP` or `PBX_DOMAIN` (testfusn.srve.cc) - this is your upstream PBX
- `TURN_USERNAME` / `TURN_CREDENTIAL` - unless you change coturn config
- Certificate paths in docker-compose.yml (will work as-is if certs are placed correctly)

✅ **Must have on new server**:
- Valid SSL certificates in `./certs/` (fullchain.pem, privkey.pem)
- DNS A record: `phonex.srve.cc` → `<NEW_SERVER_IP>`
- Reverse DNS correctly configured (optional but recommended)
- Inbound ports open: 80, 443, 5060-5061 (TCP/UDP), 3478 (TURN), 49160-49200 (RTP)

---

## Troubleshooting

### WebSocket connection fails (ERR_NAME_NOT_RESOLVED)
→ DNS not updated or cached. Clear browser cache (Ctrl+Shift+Delete), try different browser.

### DTLS fingerprint missing
→ Check if RTPEngine is running: `docker-compose logs rtpengine | tail -20`

### "Register failed (403 Forbidden)"
→ Check if PBX can reach new server IP. Test: `kamailio logs | grep PBX`

### Incoming calls not working
→ Check `kamcmd ul.dump` - registrations should show. If empty, registration failing.

---

## Automated Migration Script

Or use this script to automate (test on a non-production clone first):

```bash
#!/bin/bash
set -e

NEW_DOMAIN=$1
NEW_IP=$2

if [ -z "$NEW_DOMAIN" ] || [ -z "$NEW_IP" ]; then
  echo "Usage: $0 <new_domain> <new_ip>"
  exit 1
fi

echo "Migrating to $NEW_DOMAIN with IP $NEW_IP..."

# Update .env
sed -i "s/^DOMAIN=.*/DOMAIN=$NEW_DOMAIN/" .env
sed -i "s/^PUBLIC_IP=.*/PUBLIC_IP=$NEW_IP/" .env

# Create nginx config
cp nginx/phone.srve.cc.conf "nginx/${NEW_DOMAIN}.conf"
sed -i "s/phone.srve.cc/$NEW_DOMAIN/g" "nginx/${NEW_DOMAIN}.conf"

# Update docker-compose
sed -i "s|./nginx/phone.srve.cc.conf|./nginx/${NEW_DOMAIN}.conf|g" docker-compose.yml

# Update source files
sed -i "s/phone.srve.cc/$NEW_DOMAIN/g" www/app/config.js
sed -i "s/phone.srve.cc/$NEW_DOMAIN/g" www/index.html

echo "✅ Migration complete!"
echo "Next steps:"
echo "1. Verify changes: git diff"
echo "2. Copy certificates to ./certs/"
echo "3. Run: docker-compose up -d"
```

---

**Last Updated**: 2026-03-06  
**Project**: WebRTC SBC (Kamailio + RTPEngine)
