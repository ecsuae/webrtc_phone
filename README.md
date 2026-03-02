# WebRTC SBC - Complete Setup Guide

Complete WebRTC Session Border Controller with Kamailio, RTPEngine, COTURN, and Push Notifications.

## 🚀 Quick Start (Plug & Play)

### Prerequisites
- Linux server (Ubuntu 20.04+ / Debian 11+)
- Docker & Docker Compose installed
- SSL certificates (Let's Encrypt recommended)
- Public IP address with ports open (see Port Requirements)

### Installation Steps

```bash
# 1. Clone repository
git clone <your-repo-url> /opt/webrtc-sbc
cd /opt/webrtc-sbc

# 2. Run setup script (generates VAPID keys and creates .env)
./scripts/setup.sh

# 3. Edit .env file with your configuration
nano .env

# Required changes:
# - DOMAIN: Your domain name (e.g., phone.example.com)
# - PUBLIC_IP: Your server's public IP
# - PBX_IP: Your PBX/FreeSWITCH IP or domain
# - VAPID_SUBJECT: Your contact email (e.g., mailto:admin@example.com)

# 4. Place SSL certificates
mkdir -p certs
# Copy your certificates:
# - certs/fullchain.pem
# - certs/privkey.pem

# 5. Start all services
docker-compose up -d

# 6. Verify services are running
docker-compose ps

# 7. Check logs
docker-compose logs -f
```

That's it! Your WebRTC SBC is now running.

## 🔧 Configuration Files

### Main Configuration
- `.env` - Primary configuration file (edit this after setup)
- `.env.example` - Template with all available options

### Component Configuration
- `kamailio/kamailio.cfg` - Kamailio SIP proxy configuration
- `kamailio/local.cfg` - Local Kamailio settings (auto-generated from .env)
- `nginx/phone.srve.cc.conf` - Nginx reverse proxy configuration
- `push-server/` - Push notification server (Dockerized)

## 📦 Services Overview

### Service Architecture
```
┌─────────────────────────────────────────────────────┐
│                 Internet (WebRTC)                   │
└────────────┬────────────────────────────────────────┘
             │ HTTPS(443) + WSS(443)
      ┌──────▼───────┐
      │    Nginx     │  (Reverse Proxy + Static Files)
      └──────┬───────┘
             │ WSS → 8443
      ┌──────▼───────┐
      │   Kamailio   │  (SIP Proxy)
      └──────┬───────┘
             │ SIP → 5060
      ┌──────▼───────┐         ┌─────────────┐
      │  FreeSWITCH  │◄────────┤  RTPEngine  │
      │     PBX      │   RTP   └─────────────┘
      └──────────────┘
             │
      ┌──────▼───────────┐
      │  Push Server     │  (Web Push Notifications)
      │  (Port 3001)     │
      └──────────────────┘
```

### Services in Docker Compose

| Service | Container Name | Description |
|---------|----------------|-------------|
| **nginx** | phone-nginx | Web server + reverse proxy |
| **kamailio** | kamailio | SIP proxy (WebSocket to SIP) |
| **rtpengine** | rtpengine | RTP proxy and media relay |
| **coturn** | coturn | TURN/STUN server for NAT traversal |
| **push-server** | push-server | Push notification server |

## 🔐 Port Requirements

Open these ports on your firewall:

### Required Ports
- **443** (TCP) - HTTPS + WebSocket (Nginx)
- **80** (TCP) - HTTP redirect to HTTPS
- **5060** (UDP) - SIP to PBX
- **3478** (UDP) - TURN server
- **5349** (TCP) - TURN over TLS

### RTP Media Ports
- **30000-31000** (UDP) - RTPEngine media
- **49160-49200** (UDP) - COTURN media relay

### Internal Ports (No need to open)
- **8443** - Kamailio WebSocket (proxied by Nginx)
- **3001** - Push server API (proxied by Nginx)
- **2223** - RTPEngine control socket

## 🔔 Push Notifications

Push notifications are automatically configured during setup:

### How It Works
1. User registers → Browser subscribes to push notifications
2. Incoming call → Kamailio triggers push notification API
3. Push server → Sends notification via Web Push protocol
4. User's device → Shows notification with Answer/Reject buttons
5. User clicks Answer → Browser opens and call connects

### Browser Support
- ✅ Desktop Chrome, Firefox, Edge
- ✅ Android Chrome, Firefox
- ⚠️ iOS Safari (iOS 16.4+, requires PWA installation)

### Testing Push Notifications

```bash
# 1. Check push server status
docker logs push-server

# 2. Test API endpoint
curl https://your-domain.com/api/push/vapid-public-key

# 3. Send test notification (after browser subscribes)
curl -X POST http://localhost:3001/api/push/notify \
  -H "Content-Type: application/json" \
  -d '{"extension":"1001","from":"Test","title":"Test Call"}'
```

## 🛠️ Service Management

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker restart <container-name>

# View logs
docker-compose logs -f [service-name]
```

### Update Configuration
```bash
# 1. Edit configuration files
nano .env

# 2. Rebuild if needed (only for push-server code changes)
docker-compose build push-server

# 3. Restart affected services
docker-compose up -d

# Or restart specific service
docker restart push-server
```

### Check Service Status
```bash
# All services
docker-compose ps

# Specific service health
docker inspect push-server --format='{{.State.Health.Status}}'

# View logs
docker logs push-server --tail 50 -f
```

## 🔍 Troubleshooting

### Push Notifications Not Working

1. **Check push server is running:**
   ```bash
   docker ps | grep push-server
   docker logs push-server
   ```

2. **Verify VAPID keys are configured:**
   ```bash
   curl http://localhost:3001/health
   # Should show: "vapidConfigured": true
   ```

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for push subscriptionerrors in Console
   - Check Network tab for API calls to `/api/push/`

4. **Test API endpoint:**
   ```bash
   curl https://your-domain.com/api/push/vapid-public-key
   ```

### Kamailio Not Connecting to PBX

1. **Check PBX connectivity:**
   ```bash
   docker exec kamailio ping -c 3 your-pbx-ip
   ```

2. **Verify PBX accepts SIP from Kamailio IP:**
   - Check PBX ACL/firewall rules
   - Ensure port 5060 UDP is open

3. **Check Kamailio logs:**
   ```bash
   docker logs kamailio --tail 100
   ```

### WebRTC Audio Issues

1. **Check RTPEngine status:**
   ```bash
   docker logs rtpengine
   ```

2. **Verify RTP ports are open:**
   ```bash
   # From external machine
   nc -zvu your-public-ip 30000-30010
   ```

3. **Test TURN server:**
   ```bash
   # Use Trickle ICE test: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
   ```

### WebSocket Connection Failed

1. **Check Nginx and Kamailio:**
   ```bash
   docker logs phone-nginx
   docker logs kamailio
   ```

2. **Verify SSL certificates:**
   ```bash
   ls -l certs/
   # Should show fullchain.pem and privkey.pem
   ```

3. **Test WebSocket endpoint:**
   ```bash
   # From browser console:
   ws = new WebSocket('wss://your-domain.com/ws');
   ```

## 🔄 Migration to New Server

Moving to a new server is simple:

```bash
# 1. On old server - backup configuration
tar -czf webrtc-sbc-backup.tar.gz .env certs/

# 2. On new server - clone and restore
git clone <your-repo> /opt/webrtc-sbc
cd /opt/webrtc-sbc
tar -xzf webrtc-sbc-backup.tar.gz

# 3. Update IP addresses in .env
nano .env
# Update: PUBLIC_IP, PBX_IP

# 4. Start services
docker-compose up -d
```

## 📊 Monitoring

### Health Checks
```bash
# Nginx
curl -I https://your-domain.com

# Push Server
curl http://localhost:3001/health

# Kamailio (from container)
docker exec kamailio kamctl ul show

# RTPEngine
docker exec rtpengine rtpengine-ctl list
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## 🔒 Security Best Practices

1. **Change default credentials** in `.env`:
   - `TURN_USER` and `TURN_PASS`

2. **Use strong SSL certificates:**
   - Let's Encrypt recommended
   - Auto-renewal setup

3. **Firewall configuration:**
   - Only open required ports
   - Use fail2ban for brute force protection

4. **Regular updates:**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

5. **Backup regularly:**
   ```bash
   # Backup script
   tar -czf backup-$(date +%Y%m%d).tar.gz .env certs/ kamailio/local.cfg
   ```

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | `phone.example.com` |
| `PUBLIC_IP` | Server public IP | `1.2.3.4` |
| `PBX_IP` | PBX/FreeSWITCH IP or domain | `pbx.example.com` |
| `PBX_PORT` | PBX SIP port | `5060` |
| `TURN_USER` | TURN server username | `turnuser` |
| `TURN_PASS` | TURN server password | `secure_password` |
| `RTP_MIN` | RTP port range start | `30000` |
| `RTP_MAX` | RTP port range end | `31000` |
| `VAPID_PUBLIC_KEY` | Push notification public key | Auto-generated |
| `VAPID_PRIVATE_KEY` | Push notification private key | Auto-generated |
| `VAPID_SUBJECT` | Contact email for push service | `mailto:admin@example.com` |

## 🎯 Features

✅ **Fully Dockerized** - One command deployment  
✅ **Push Notifications** - Receive calls when browser closed  
✅ **SSL/TLS Support** - Secure WebSocket connections  
✅ **NAT Traversal** - Works behind NAT with TURN server  
✅ **Mobile Support** - Progressive Web App (PWA)  
✅ **Auto-restart** - Services recover automatically  
✅ **Health Checks** - Built-in monitoring  
✅ **Hot Reload** - Update configuration without rebuilding  

## 📚 Additional Documentation

- [Push Notifications Setup](4-PUSH_NOTIFICATIONS_SETUP.md) - Detailed push notification guide
- [Kamailio Configuration](kamailio/README.md) - Advanced SIP proxy configuration
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions

## 🆘 Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review troubleshooting section above
3. Check browser console (F12) for client-side errors

## 📜 License

[Your License Here]

## 🙏 Credits

Built with:
- [Kamailio](https://www.kamailio.org/) - SIP Server
- [RTPEngine](https://github.com/sipwise/rtpengine) - RTP Proxy
- [COTURN](https://github.com/coturn/coturn) - TURN Server
- [SIP.js](https://sipjs.com/) - WebRTC JavaScript library
- [Web Push](https://github.com/web-push-libs/web-push) - Push notification library
