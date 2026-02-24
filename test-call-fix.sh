#!/bin/bash

echo "=== Call Fix - Verification ==="
echo ""

echo "1. Kamailio status:"
docker ps | grep kamailio

echo ""
echo "2. Checking if config was applied:"
docker exec kamailio grep -A 5 "MEDIA_OFFER:" /etc/kamailio/kamailio.cfg | head -10

echo ""
echo "3. Kamailio startup log:"
docker logs kamailio 2>&1 | grep -i "module\|listen\|error" | tail -10 || echo "   (Starting...)"

echo ""
echo "=== Test Instructions ==="
echo ""
echo "1. Open https://phone.srve.cc/"
echo "2. Register (should still show 'Registered')"
echo "3. Call a number (e.g., 096045945060)"
echo "4. Check if call connects"
echo ""
echo "If call still fails, check FusionPBX logs:"
echo "  tail -f /var/log/freeswitch/freeswitch.log"
echo ""

