#!/bin/bash

# FusionPBX SIP Profile Configuration Fix for WebRTC Relay Candidates
# This script modifies the internal SIP profile to accept relay candidates

PROFILE_DIR="/etc/freeswitch/sip_profiles"
INTERNAL_PROFILE="$PROFILE_DIR/internal.xml"

echo "=== FusionPBX Internal SIP Profile Configuration ==="
echo ""
echo "Current profile location: $INTERNAL_PROFILE"
echo ""

if [ ! -f "$INTERNAL_PROFILE" ]; then
    echo "ERROR: SIP profile not found at $INTERNAL_PROFILE"
    echo "Checking for alternatives..."
    find /etc/freeswitch -name "*internal*" -type f 2>/dev/null | head -5
    exit 1
fi

echo "Checking current configuration..."
echo ""

# Check current settings
if grep -q "FORCE_CANDIDATE_ACL" "$INTERNAL_PROFILE"; then
    echo "Found FORCE_CANDIDATE_ACL setting"
    grep "FORCE_CANDIDATE_ACL" "$INTERNAL_PROFILE" || true
else
    echo "FORCE_CANDIDATE_ACL not found - needs to be added"
fi

echo ""
echo "Configuration checks needed:"
echo "1. Set rtp-ip to internal bridge IP (172.18.0.1 or similar)"
echo "2. Accept relay candidates from WebRTC client"
echo "3. Configure DTLS/SRTP properly"
echo ""
echo "Recommended configuration:"
echo "  <param name=\"force-candidate-acl\" value=\"\"/>"
echo "  <param name=\"rtp-ip\" value=\"172.18.0.1\"/>"
echo "  <param name=\"sip-ip\" value=\"172.18.0.1\"/>"
echo ""
echo "OR whitelist the relay IP:"
echo "  <param name=\"force-candidate-acl\" value=\"172.18.0.1\"/>"
echo ""

# Backup the original
if [ ! -f "$INTERNAL_PROFILE.backup" ]; then
    echo "Creating backup of original profile..."
    cp "$INTERNAL_PROFILE" "$INTERNAL_PROFILE.backup"
    echo "Backup saved to: $INTERNAL_PROFILE.backup"
else
    echo "Backup already exists: $INTERNAL_PROFILE.backup"
fi

echo ""
echo "To apply fix manually:"
echo "1. SSH into FusionPBX server"
echo "2. Edit: $INTERNAL_PROFILE"
echo "3. Find the <profile> section"
echo "4. Modify or add these parameters:"
echo "   <param name=\"force-candidate-acl\" value=\"\"/>"
echo "   <param name=\"force-common-bitrate\" value=\"true\"/>"
echo "5. Restart FreeSWITCH: freeswitch -stop && sleep 2 && freeswitch"
echo ""

