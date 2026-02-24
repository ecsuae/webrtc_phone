#!/bin/bash
# Troubleshoot Outgoing Call Issues

echo "============================================="
echo "  WebRTC SBC - Call Troubleshooting"
echo "============================================="
echo ""

echo "📦 1. Container Status:"
timeout 5 docker ps --format "  {{.Names}}: {{.Status}}" 2>&1 || echo "  ⚠️ Docker command timed out"
echo ""

echo "🔌 2. RTPEngine Connection Test:"
timeout 3 docker exec kamailio timeout 2 nc -zv rtpengine 22222 2>&1 | head -3 || echo "  ⚠️ Cannot connect to RTPEngine"
echo ""

echo "📊 3. Kamailio RTPEngine Status:"
timeout 5 docker logs kamailio 2>&1 | grep -i "rtpengine.*found\|rtpengine.*enabled" | tail -2 || echo "  ⚠️ No RTPEngine status found"
echo ""

echo "🚨 4. Recent Errors (last 20):"
timeout 5 docker logs kamailio 2>&1 | grep -i "error\|critical" | tail -20 | head -10 || echo "  ℹ️ No recent errors"
echo ""

echo "📞 5. Recent INVITE Attempts:"
timeout 5 docker logs kamailio 2>&1 | grep -i "INVITE\|MEDIA_OFFER" | tail -5 || echo "  ℹ️ No recent INVITEs"
echo ""

echo "🔧 6. Quick Fixes:"
echo "  • If RTPEngine not connected: docker restart rtpengine kamailio"
echo "  • If containers stopped: cd /opt/webrtc-sbc && docker compose up -d"
echo "  • Check registration: Look for 'WS SIP REGISTER' in logs"
echo ""

echo "📝 7. Test Outgoing Call:"
echo "  1. Open browser console (F12)"
echo "  2. Make a call"
echo "  3. Look for WebSocket messages and SIP INVITE"
echo "  4. Check this log: docker logs kamailio 2>&1 | tail -50"
echo ""

echo "============================================="

