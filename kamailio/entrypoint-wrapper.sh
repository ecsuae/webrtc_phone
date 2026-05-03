#!/bin/sh
set -eu

TEMPLATE_SRC="/config/local.cfg.template"
OUT_CFG="/etc/kamailio/local.cfg"

if [ ! -f "${TEMPLATE_SRC}" ]; then
  echo "kamailio wrapper: missing template: ${TEMPLATE_SRC}" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "kamailio wrapper: envsubst not found (required to render local.cfg)" >&2
  exit 1
fi

# Render only the tokens used by local.cfg.template.
envsubst '${PBX_IP} ${PBX_PORT} ${PUBLIC_IP} ${RTPENGINE_NG_PORT}' < "${TEMPLATE_SRC}" > "${OUT_CFG}"

exec /usr/sbin/kamailio -DD -E -f /etc/kamailio/kamailio.cfg
