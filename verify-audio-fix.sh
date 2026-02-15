#!/bin/bash
# Audio Fix Verification Script

echo "==========================================="
echo "  Two-Way Audio Configuration Verification"
echo "==========================================="
echo ""

echo "📋 Checking RTPEngine Configuration..."
if grep -q "external/eth0.*internal/eth0" /opt/webrtc-sbc/rtpengine/rtpengine.conf; then
    echo "  ✅ RTPEngine: Interface labels configured (external/internal)"
else
    echo "  ❌ RTPEngine: Missing interface labels"
fi

echo ""
echo "📋 Checking Kamailio Media Routes..."
if grep -q "direction=internal-external" /opt/webrtc-sbc/kamailio/kamailio.cfg; then
    echo "  ✅ Kamailio: Direction flags present (internal-external)"
else
    echo "  ❌ Kamailio: Missing direction flags"
fi

if grep -q "direction=external-internal" /opt/webrtc-sbc/kamailio/kamailio.cfg; then
    echo "  ✅ Kamailio: Direction flags present (external-internal)"
else
    echo "  ❌ Kamailio: Missing direction flags"
fi

echo ""
echo "🔊 Audio Flow Configuration:"
echo "  WebRTC (internal) ←→ RTPEngine ←→ FusionPBX (external)"
echo "  SRTP/DTLS/ICE    ←→ transcode  ←→ RTP/UDP"
echo ""

echo "🧪 Testing Instructions:"
echo "  1. Register at https://phone.srve.cc"
echo "  2. Make an outgoing call"
echo "  3. Verify BOTH parties can hear each other"
echo "  4. Check for audio quality (no echo/delay)"
echo ""

echo "📊 Container Status:"
docker ps --format "  {{.Names}}: {{.Status}}" | grep -E "kamailio|rtpengine" || echo "  ⚠️  Containers may need restart"

echo ""
echo "🔄 If audio still has issues, restart services:"
echo "  docker restart rtpengine kamailio"
echo ""
echo "==========================================="

