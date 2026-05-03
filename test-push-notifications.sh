#!/bin/bash
# Push Notification System Test Script

set -eu

if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi

DOMAIN=${DOMAIN:-"<your-domain>"}

echo "═══════════════════════════════════════════════"
echo " Push Notification System - Complete Test"
echo "═══════════════════════════════════════════════"
echo ""

# Step 1: Check push server status
echo "Step 1: Checking push server status..."
curl -s http://127.0.0.1:3001/health | jq '.'
echo ""

# Step 2: Check current subscriptions
echo "Step 2: Current push subscriptions:"
curl -s http://127.0.0.1:3001/api/push/subscriptions | jq '{total, subscriptions: (.subscriptions | map({extension, deviceInfo}))}'
echo ""

# Step 3: Test manual push notification
echo "Step 3: Send test push notification to extension 100360..."
curl -s -X POST http://127.0.0.1:3001/api/push/notify \
  -H "Content-Type: application/json" \
  -d '{
    "extension": "100360",
    "from": "TEST_SYSTEM",
    "title": "Test Push Notification",
    "body": "Testing push notification system"
  }' | jq '.'
echo ""

echo "═══════════════════════════════════════════════"
echo " NEXT STEPS TO COMPLETE SETUP:"
echo "═══════════════════════════════════════════════"
echo ""
echo "ON IPHONE (https://${DOMAIN}/):"
echo "  1. Hard refresh the browser (pull down or close/reopen)"
echo "  2. Login with extension 100360"
echo "  3. Browser will prompt: 'Show notifications?'"
echo "  4. Tap 'Allow' to enable push notifications"
echo "  5. Check console for: [Push] Subscription registered with server"
echo ""
echo "ON LAPTOP:"
echo "  6. Run this script again to see subscription count increase"
echo "  7. Lock iPhone screen"
echo "  8. From laptop (extension 100357), call 100360"
echo "  9. iPhone should receive push notification"
echo " 10. Tap notification → App opens → Call rings!"
echo ""
echo "═══════════════════════════════════════════════"
echo " TROUBLESHOOTING:"
echo "═══════════════════════════════════════════════"
echo ""
echo "If notification permission was previously denied:"
echo "  • iPhone Settings → Safari → Notifications → Allow"
echo "  • Or clear Safari data and try again"
echo ""
echo "Check Kamailio logs for push triggers:"
echo "  docker-compose logs --tail=50 kamailio | grep PUSH"
echo ""
echo "Monitor push server logs:"
echo "  docker-compose logs -f push-server"
echo ""
