#!/bin/bash
# Initial setup script for WebRTC SBC
# Run this after cloning the repository

set -e

echo "════════════════════════════════════════"
echo "  WebRTC SBC - Initial Setup"
echo "════════════════════════════════════════"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to regenerate VAPID keys? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping VAPID key generation"
        exit 0
    fi
else
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and update:"
    echo "   - DOMAIN (your domain name)"
    echo "   - PUBLIC_IP (your server's public IP)"
    echo "   - PBX_IP (your PBX/FreeSWITCH IP or domain)"
    echo "   - PBX_PORT (default 5060)"
    echo "   - TURN_USER and TURN_PASS (TURN server credentials)"
    echo "   - VAPID_SUBJECT (your contact email)"
    echo ""
fi

# Generate VAPID keys
echo "Generating VAPID keys for push notifications..."
cd push-server
if [ ! -f "node_modules/.bin/web-push" ]; then
    echo "Installing push-server dependencies..."
    npm install
fi

# Generate keys and parse output
echo ""
KEY_OUTPUT=$(node generate-keys.js)
PUBLIC_KEY=$(echo "$KEY_OUTPUT" | grep "^VAPID_PUBLIC_KEY=" | cut -d= -f2)
PRIVATE_KEY=$(echo "$KEY_OUTPUT" | grep "^VAPID_PRIVATE_KEY=" | cut -d= -f2)

if [ -z "$PUBLIC_KEY" ] || [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Failed to generate VAPID keys"
    exit 1
fi

cd ..

# Update .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$PUBLIC_KEY|" .env
    sed -i '' "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$PRIVATE_KEY|" .env
else
    # Linux
    sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$PUBLIC_KEY|" .env
    sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$PRIVATE_KEY|" .env
fi

echo "✓ VAPID keys generated and saved to .env"
echo ""

# Update www/app/push.js with public key
if [ -f "www/app/push.js" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|const VAPID_PUBLIC_KEY = '.*';|const VAPID_PUBLIC_KEY = '$PUBLIC_KEY';|" www/app/push.js
    else
        sed -i "s|const VAPID_PUBLIC_KEY = '.*';|const VAPID_PUBLIC_KEY = '$PUBLIC_KEY';|" www/app/push.js
    fi
    echo "✓ Public key updated in www/app/push.js"
fi

echo ""
echo "════════════════════════════════════════"
echo "  Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Place SSL certificates in ./certs/"
echo "   - fullchain.pem"
echo "   - privkey.pem"
echo "3. Run: docker-compose up -d"
echo ""
