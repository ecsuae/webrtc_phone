#!/usr/bin/env sh
set -eu

cat > /etc/coturn/turnserver.conf <<EOF
listening-port=3478
realm=${DOMAIN}
server-name=${DOMAIN}

fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_PASS}

external-ip=${PUBLIC_IP}
listening-ip=0.0.0.0
relay-ip=0.0.0.0

min-port=49160
max-port=49200

allowed-peer-ip=0.0.0.0-255.255.255.255
allowed-peer-ip=::0-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff

# TEMP while debugging:
# no-loopback-peers
# no-multicast-peers

verbose
log-file=stdout
EOF

echo "===== EFFECTIVE TURN CONFIG ====="
nl -ba /etc/coturn/turnserver.conf | sed -n '1,140p'
echo "================================="

exec turnserver -c /etc/coturn/turnserver.conf -n -v
