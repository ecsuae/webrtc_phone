#!/bin/bash
# WebRTC SBC Status Check Script

echo "========================================="
echo "  WebRTC SBC Status Check"
echo "========================================="
echo ""

echo "📦 Container Status:"
docker ps --format "  {{.Names}}: {{.Status}}" | grep -E "kamailio|nginx|rtpengine|coturn"
echo ""

echo "🔍 Service Health:"
docker exec kamailio pidof kamailio > /dev/null 2>&1 && echo "  ✅ Kamailio: Process running" || echo "  ❌ Kamailio: Not running"
docker exec rtpengine pidof rtpengine > /dev/null 2>&1 && echo "  ✅ RTPEngine: Process running" || echo "  ❌ RTPEngine: Not running"
docker exec coturn pidof turnserver > /dev/null 2>&1 && echo "  ✅ COTURN: Process running" || echo "  ❌ COTURN: Not running"
docker exec phone-nginx pidof nginx > /dev/null 2>&1 && echo "  ✅ Nginx: Process running" || echo "  ❌ Nginx: Not running"
echo ""

echo "🌐 Network Connectivity:"
curl -s -o /dev/null -w "  HTTPS (443): %{http_code}\n" https://phone.srve.cc/ -k
curl -s -o /dev/null -w "  WebSocket Proxy: %{http_code}\n" -H "Upgrade: websocket" -H "Connection: Upgrade" https://phone.srve.cc/ws -k
echo ""

echo "📊 Docker Compose Version:"
echo "  $(docker compose version)"
echo ""

echo "========================================="
echo "  For detailed logs:"
echo "    docker logs kamailio"
echo "    docker logs rtpengine"
echo "  Status doc: /opt/webrtc-sbc/FIXES_APPLIED.md"
echo "========================================="

