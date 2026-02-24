#!/bin/bash

echo "=== System Diagnostic ==="
echo ""

echo "1. Checking if containers exist..."
docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>&1 || echo "Docker command failed"
echo ""

echo "2. Checking listening ports..."
netstat -tlpn 2>/dev/null | grep -E ":443|:8443|:80" || ss -tlpn 2>/dev/null | grep -E ":443|:8443|:80" || echo "No netstat/ss available"
echo ""

echo "3. Checking nginx logs..."
docker logs phone-nginx 2>&1 | tail -10 || echo "Cannot get nginx logs"
echo ""

echo "4. Checking kamailio logs..."
docker logs kamailio 2>&1 | tail -20 || echo "Cannot get kamailio logs"
echo ""

echo "5. Testing WebSocket connectivity..."
curl -skI https://phone.srve.cc/ 2>&1 | head -5 || echo "Cannot reach web UI"
echo ""

echo "6. Checking if WebSocket endpoint responds..."
curl -skI https://phone.srve.cc/ws 2>&1 | head -5 || echo "Cannot reach WebSocket endpoint"
echo ""

