#!/bin/bash
# RINGBACK TEST SCRIPT - Single unified diagnostic tool

clear
echo "============================================"
echo "RINGBACK TONE TEST - Direct Test"
echo "============================================"
echo ""
echo "IMPORTANT: Before testing:"
echo "1. Click the refresh icon (↻) in phone UI to clear browser cache"
echo "2. Open browser console (F12)"
echo "3. Make SURE you see: [RINGBACK] Module loaded"
echo ""
echo "============================================"
echo "Quick Test Steps:"
echo "============================================"
echo ""
echo "METHOD 1: Manual JavaScript Test"
echo "────────────────────────────────"
echo "1. Open browser console (F12)"
echo "2. Paste this command:"
echo "   window.testRingback()"
echo "3. You should HEAR a 5-second ringback tone"
echo "4. (This doesn't need a call, just tests the audio)"
echo ""
echo ""
echo "METHOD 2: Real Call Test"
echo "─────────────────────────"
echo "1. Keep console open"
echo "2. Make an outgoing call"
echo "3. Look for: [RINGBACK-AUDIO] 🔊 STARTING RINGBACK" 
echo "4. Listen for the tone"
echo ""
echo ""
echo "METHOD 3: Server Log Monitor"
echo "──────────────────────────────"
echo "Running server log monitor for 60 seconds..."
echo ""

timeout 60 docker-compose logs -f --tail=0 kamailio 2>&1 | \
  grep --line-buffered -E "OUTGOING|180.*Ringing" &
LOGPID=$!

echo "Make your test call NOW..."
sleep 60
kill $LOGPID 2>/dev/null

echo ""
echo "============================================"
echo "DONE. Check your observations above."
echo "============================================"

