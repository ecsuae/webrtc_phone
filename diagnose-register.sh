#!/bin/bash

echo "=== Registration Troubleshooting ==="
echo ""

echo "1. Checking Kamailio is forwarding REGISTER to FusionPBX..."
echo "   Looking for RELAY_TO_PBX logs:"
docker logs kamailio 2>&1 | grep "RELAY_TO_PBX\|testfusn\|900900" | tail -20 || echo "   No messages found"

echo ""
echo "2. Checking for REGISTER errors in Kamailio:"
docker logs kamailio 2>&1 | grep -i "register\|error\|critical" | head -20 || echo "   No errors"

echo ""
echo "3. Environment variables in Kamailio:"
docker exec kamailio bash -c 'echo "PBX_IP=$PBX_IP, PBX_PORT=$PBX_PORT, PBX_TRANSPORT=$PBX_TRANSPORT"' 2>&1

echo ""
echo "4. Checking DNS resolution from Kamailio:"
docker exec kamailio bash -c "getent hosts testfusn.srve.cc 2>&1" || echo "   Cannot resolve testfusn.srve.cc"

echo ""
echo "5. Testing direct SIP connection to FusionPBX:"
echo "   (From host machine)"
timeout 3 bash -c 'exec 3<>/dev/udp/testfusn.srve.cc/5060; echo "OPTIONS sip:test@testfusn.srve.cc SIP/2.0" >&3; cat <&3' 2>&1 | head -5 || echo "   Cannot reach FusionPBX"

echo ""
echo "6. Checking Kamailio config for PBX settings:"
grep -A 20 "route\[RELAY_TO_PBX\]" /opt/webrtc-sbc/kamailio/kamailio.cfg | head -25

echo ""
echo "=== Analysis ==="
echo "If RELAY_TO_PBX shows messages, then Kamailio is forwarding."
echo "If FusionPBX is unreachable, that's the problem."
echo "If FusionPBX is reachable but REGISTER is rejected, check:"
echo "  - Extension 900900 exists in FusionPBX"
echo "  - Password is correct"
echo "  - Domain testfusn.srve.cc is properly configured in FusionPBX"
echo ""

