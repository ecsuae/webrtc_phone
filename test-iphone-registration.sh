#!/bin/bash
# Test script to monitor iPhone registration

set -eu

if [ -f ./.env ]; then
    set -a
    . ./.env
    set +a
fi

DOMAIN=${DOMAIN:-"${DOMAIN:-<your-domain>}"}
ADMIN_WG_BIND_HOST=${ADMIN_WG_BIND_HOST:-"<wireguard-admin-ip>"}
ADMIN_WG_BIND_PORT=${ADMIN_WG_BIND_PORT:-"<admin-port>"}

echo "=== iPhone Registration Test ==="
echo "1. Enable debug mode on iPhone at https://${DOMAIN}/"
echo "2. Login with extension 100360"
echo "3. Lock the iPhone screen"
echo "4. Wait 2 minutes"
echo "5. From another device, call 100360"
echo ""
echo "=== Monitoring (Ctrl+C to stop) ==="
echo ""

while true; do
    clear
    echo "=== Current Time: $(date '+%H:%M:%S') ==="
    echo ""
    
    echo "--- iPhone Device Status ---"
    curl -s "http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/api/logs/mobile/metadata" | \
        jq -r '.logFiles[] | select(.filename == "device_31b46344.json")' 2>/dev/null
    cat backups/mobile-logs/metadata/device_31b46344.json 2>/dev/null | \
        jq '{username: .currentUsername, debugMode, lastSeen, screenLocked: (now - (.lastSeen | fromdateiso8601) | if . > 120 then "POSSIBLY LOCKED" else "ACTIVE" end)}'
    echo ""
    
    echo "--- SIP Registration Status ---"
    docker-compose exec -T kamailio kamctl ul show 2>/dev/null | grep -A5 "100360" || echo "❌ Extension 100360 NOT registered"
    echo ""
    
    echo "--- Recent Debug Logs (last 3) ---"
    curl -s "http://${ADMIN_WG_BIND_HOST}:${ADMIN_WG_BIND_PORT}/api/logs/mobile/debug" 2>/dev/null | \
        jq -r '.logs | map(select(.currentUsername == "100360")) | .[-3:][] | "\(.timestamp) - \(.message)"' 2>/dev/null || echo "No debug logs yet"
    echo ""
    
    sleep 5
done
