#!/usr/bin/env sh
set -eu

: "${DOMAIN:?DOMAIN is required}"
: "${PUBLIC_IP:?PUBLIC_IP is required}"
: "${TURN_USER:?TURN_USER is required}"
: "${TURN_PASS:?TURN_PASS is required}"

cat > /etc/coturn/turnserver.conf <<EOF
listening-port=3478
realm=${DOMAIN}
server-name=${DOMAIN}

fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_PASS}

# No NAT: advertise the real public IP as relay too
external-ip=${PUBLIC_IP}
listening-ip=0.0.0.0
relay-ip=${PUBLIC_IP}

min-port=49160
max-port=49200

no-multicast-peers
no-loopback-peers

verbose
log-file=stdout
EOF

echo "=== coturn starting ==="
echo "DOMAIN=${DOMAIN}"
echo "PUBLIC_IP=${PUBLIC_IP}"
echo "TURN_USER=${TURN_USER}"
echo "PORT=3478"
echo "RELAY PORTS=49160-49200"
echo "======================="

exec turnserver -c /etc/coturn/turnserver.conf -n -v