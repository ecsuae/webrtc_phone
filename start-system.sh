#!/bin/bash
set -e

echo "=========================================="
echo "WebRTC SBC - Complete System Startup"
echo "=========================================="
echo ""

cd /opt/webrtc-sbc

# Step 1: Stop everything
echo "Step 1: Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
sleep 2

# Step 2: Remove any orphaned containers
echo ""
echo "Step 2: Cleaning up..."
docker compose down --remove-orphans 2>&1 | grep -v "^$" || true
sleep 2

# Step 3: Start services
echo ""
echo "Step 3: Starting services..."
docker compose up -d

# Step 4: Wait for startup
echo ""
echo "Step 4: Waiting for services to start (15 seconds)..."
sleep 15

# Step 5: Check status
echo ""
echo "Step 5: Container Status:"
docker compose ps

echo ""
echo "Step 6: Checking ports..."
echo "Port 443 (HTTPS/WSS):"
netstat -tlpn 2>/dev/null | grep ":443 " || ss -tlpn 2>/dev/null | grep ":443 " || echo "  Not listening or command not available"
echo "Port 8443 (Kamailio WS):"
docker exec kamailio netstat -tlpn 2>/dev/null | grep ":8443" || echo "  Cannot check (container may not be ready)"

echo ""
echo "Step 7: Checking Kamailio..."
echo "Looking for WebSocket listener in Kamailio logs:"
docker logs kamailio 2>&1 | grep -i "listen\|8443\|websocket" | tail -5 || echo "  No websocket messages found"

echo ""
echo "Step 8: Checking for errors..."
ERRORS=$(docker logs kamailio 2>&1 | grep -i "ERROR\|CRITICAL" | wc -l)
if [ "$ERRORS" -gt 0 ]; then
    echo "  ⚠️ Found $ERRORS errors in Kamailio:"
    docker logs kamailio 2>&1 | grep -i "ERROR\|CRITICAL" | tail -10
else
    echo "  ✅ No errors in Kamailio"
fi

echo ""
echo "Step 9: Testing connectivity..."
echo "Web UI (https://phone.srve.cc/):"
if curl -skI https://phone.srve.cc/ 2>/dev/null | head -1 | grep -q "200"; then
    echo "  ✅ Web UI accessible"
else
    echo "  ❌ Web UI not accessible"
fi

echo "WebSocket endpoint (/ws):"
RESPONSE=$(curl -skI https://phone.srve.cc/ws 2>&1 | head -1)
echo "  Response: $RESPONSE"

echo ""
echo "=========================================="
echo "Startup Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open https://phone.srve.cc/"
echo "2. Register with:"
echo "   - Extension: 900900"
echo "   - Domain: testfusn.srve.cc"
echo "   - Password: your_password"
echo ""
echo "If registration fails, run:"
echo "  docker logs kamailio -f"
echo "  docker logs phone-nginx -f"
echo ""

