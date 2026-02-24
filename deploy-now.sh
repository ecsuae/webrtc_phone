#!/bin/bash
set -e

echo "=========================================="
echo "Deploying WebRTC SBC (WITHOUT RTPEngine)"
echo "=========================================="
echo ""

cd /opt/webrtc-sbc

echo "Step 1: Stopping any existing containers..."
docker compose down --remove-orphans 2>&1 | grep -E "Removed|Network" || echo "Nothing to remove"
sleep 2

echo ""
echo "Step 2: Starting services (kamailio, nginx, coturn)..."
docker compose up -d

echo ""
echo "Step 3: Waiting for containers to start..."
sleep 8

echo ""
echo "Step 4: Checking container status..."
docker compose ps

echo ""
echo "Step 5: Checking for errors..."
docker logs kamailio 2>&1 | grep -i "ERROR\|CRITICAL" | head -5 || echo "✅ No critical errors in Kamailio"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "System Status:"
echo "  - Services: kamailio, nginx, coturn"
echo "  - RTPEngine: DISABLED (no Docker images)"
echo "  - Mode: Signaling + TURN relay"
echo ""
echo "Test your system:"
echo "  1. Open https://phone.srve.cc/"
echo "  2. Register with testfusn.srve.cc"
echo "  3. Make a test call"
echo ""
echo "View logs:"
echo "  docker logs kamailio -f"
echo "  docker logs coturn -f"
echo ""

