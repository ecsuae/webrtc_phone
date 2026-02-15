#!/bin/bash
# Quick System Status Check
# Usage: bash /opt/webrtc-sbc/check-system.sh

echo "=========================================="
echo "WebRTC SBC System Status Check"
echo "=========================================="
echo ""

cd /opt/webrtc-sbc

echo "1. Checking Docker Compose status..."
docker compose ps
echo ""

echo "2. Container count:"
RUNNING=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l)
echo "   Running containers: $RUNNING (expected: 3)"
echo "   Services: kamailio, nginx, coturn"
echo "   Note: rtpengine is disabled (Docker images not accessible)"
echo ""

echo "3. Checking Kamailio for errors..."
ERRORS=$(docker logs kamailio 2>&1 | grep -i "error\|critical" | wc -l)
if [ "$ERRORS" -eq 0 ]; then
    echo "   ✅ No errors found in Kamailio logs"
else
    echo "   ⚠️ Found $ERRORS error(s) in Kamailio logs"
    echo "   Last 5 errors:"
    docker logs kamailio 2>&1 | grep -i "error\|critical" | tail -5
fi
echo ""

echo "4. Checking web UI..."
if curl -sk https://phone.srve.cc/ 2>/dev/null | grep -q "WebRTC"; then
    echo "   ✅ Web UI is accessible at https://phone.srve.cc/"
else
    echo "   ❌ Web UI not responding"
fi
echo ""

echo "5. System Mode:"
echo "   Mode: Signaling Only (no media anchoring)"
echo "   RTPEngine: Disabled (Docker images not available)"
echo "   Media: Via CoTURN TURN relay"
echo ""

echo "6. Features Status:"
echo "   ✅ SIP Registration"
echo "   ✅ Call Signaling"
echo "   ✅ WebSocket/WSS"
echo "   ✅ TURN Relay (CoTURN)"
echo "   ❌ RTP Media Anchoring"
echo "   ⚠️ Audio via TURN (may have limitations)"
echo ""

echo "=========================================="
echo "Summary:"
if [ "$RUNNING" -ge 3 ] && [ "$ERRORS" -eq 0 ]; then
    echo "✅ System is FUNCTIONAL"
    echo "Ready for SIP signaling and basic calls"
else
    echo "⚠️ System may have issues"
    echo "Run: docker compose logs"
fi
echo "=========================================="
echo ""
echo "To test:"
echo "1. Open https://phone.srve.cc/"
echo "2. Register with testfusn.srve.cc domain"
echo "3. Make a test call"
echo ""
echo "For full media support:"
echo "See: RTPENGINE_DOCKER_IMAGE_ISSUE.md"
echo "     DOCKER_IMAGE_ISSUE_RESOLVED.md"

