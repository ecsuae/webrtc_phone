#!/bin/bash
# RTPEngine Container Fix - Complete Startup Script
# Usage: bash /opt/webrtc-sbc/fix-rtpengine-startup.sh

set -e

COMPOSE_FILE="/opt/webrtc-sbc/docker-compose.yml"
WORKDIR="/opt/webrtc-sbc"

echo "=================================================="
echo "RTPEngine Container Fix - Startup Script"
echo "=================================================="
echo ""

cd "$WORKDIR"

echo "Step 1: Cleaning up old containers..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
sleep 3

echo "Step 2: Starting containers with stable RTPEngine image..."
docker compose -f "$COMPOSE_FILE" up -d
sleep 10

echo ""
echo "Step 3: Checking container status..."
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Step 4: Verifying RTPEngine is listening..."
docker logs rtpengine 2>&1 | grep -E "listening|starting|rtpengine" | head -10 || echo "Checking logs..."

echo ""
echo "Step 5: Checking Kamailio startup..."
docker logs kamailio 2>&1 | grep -i "error\|critical" && echo "⚠️ Errors found in Kamailio!" || echo "✅ No critical errors in Kamailio"

echo ""
echo "Step 6: Verifying connectivity..."
sleep 5

echo "Testing RTPEngine control socket..."
docker exec kamailio bash -c "nc -zu rtpengine 22222 2>&1 && echo '✅ RTPEngine responding' || echo '⚠️ RTPEngine not responding yet'"

echo ""
echo "Step 7: Final status check..."
echo "Containers:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "=================================================="
echo "✅ RTPEngine Container Setup Complete"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Test web interface: https://phone.srve.cc/"
echo "2. Register client to: testfusn.srve.cc"
echo "3. Make test call to verify audio works"
echo ""
echo "To view logs:"
echo "  docker logs rtpengine -f        (RTPEngine logs)"
echo "  docker logs kamailio -f         (Kamailio logs)"
echo "  docker logs coturn -f           (CoTURN logs)"
echo ""

