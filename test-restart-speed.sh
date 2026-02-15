#!/bin/bash
cd /opt/webrtc-sbc

echo "=== Testing Docker Compose Performance ==="
echo ""

echo "Test 1: docker ps speed"
START=$(date +%s.%N)
docker ps > /dev/null 2>&1
END=$(date +%s.%N)
DIFF=$(echo "$END - $START" | bc)
echo "docker ps took: ${DIFF}s"
echo ""

echo "Test 2: docker compose ps speed"
START=$(date +%s.%N)
docker compose ps > /dev/null 2>&1
END=$(date +%s.%N)
DIFF=$(echo "$END - $START" | bc)
echo "docker compose ps took: ${DIFF}s"
echo ""

echo "Test 3: Restart single container (kamailio)"
START=$(date +%s.%N)
docker compose restart kamailio > /dev/null 2>&1
END=$(date +%s.%N)
DIFF=$(echo "$END - $START" | bc)
echo "Restarting kamailio took: ${DIFF}s"
echo ""

echo "Test 4: Restart two containers (rtpengine + nginx)"
START=$(date +%s.%N)
docker compose restart rtpengine nginx > /dev/null 2>&1
END=$(date +%s.%N)
DIFF=$(echo "$END - $START" | bc)
echo "Restarting rtpengine+nginx took: ${DIFF}s"
echo ""

echo "=== Summary ==="
docker compose ps

