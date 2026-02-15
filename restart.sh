#!/bin/bash

echo "=== Restarting WebRTC SBC System ==="
echo ""

cd /opt/webrtc-sbc

# Stop and remove everything
echo "Stopping containers..."
docker compose down --remove-orphans

sleep 3

# Start fresh
echo "Starting containers..."
docker compose up -d

sleep 10

echo ""
echo "=== Container Status ==="
docker compose ps

echo ""
echo "=== Checking Kamailio is listening on 8443 ==="
docker exec kamailio netstat -tln 2>/dev/null | grep 8443 || echo "Cannot check - trying ss..."
docker exec kamailio ss -tln 2>/dev/null | grep 8443 || echo "Port check failed"

echo ""
echo "=== Last 20 lines of Kamailio log ==="
docker logs kamailio 2>&1 | tail -20

echo ""
echo "=== Last 10 lines of Nginx log ==="
docker logs phone-nginx 2>&1 | tail -10

echo ""
echo "=== Testing Web UI ==="
curl -skI https://phone.srve.cc/ 2>&1 | head -5

echo ""
echo "=== System Ready ==="
echo "Try registering now at: https://phone.srve.cc/"

