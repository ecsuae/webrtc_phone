#!/bin/sh
set -eu

require() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "${value}" ]; then
    echo "ERROR: Missing required env var: ${name}" >&2
    exit 1
  fi
}

require WG_PRIVATE_KEY
require WG_PRESHARED_KEY
require WG_ADDRESS
require WG_ENDPOINT
require WG_ALLOWED_IPS
require WG_PUBLIC_KEY

umask 077

mkdir -p /config/wg_confs

WG_CONF_PATH="/config/wg_confs/wg0.conf"

cat > "${WG_CONF_PATH}" <<EOF
[Interface]
Address = ${WG_ADDRESS}
PrivateKey = ${WG_PRIVATE_KEY}

[Peer]
PublicKey = ${WG_PUBLIC_KEY}
PresharedKey = ${WG_PRESHARED_KEY}
Endpoint = ${WG_ENDPOINT}
PersistentKeepalive = ${WG_PERSISTENT_KEEPALIVE:-25}
AllowedIPs = ${WG_ALLOWED_IPS}
EOF

chmod 600 "${WG_CONF_PATH}"

exec /init
