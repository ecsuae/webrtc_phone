#!/bin/sh
set -eu

TEMPLATE_SRC="/config/rtpengine.conf.template"
OUT_CFG="/etc/rtpengine.conf"

if [ -f "${TEMPLATE_SRC}" ] && command -v envsubst >/dev/null 2>&1; then
  envsubst '${RTPENGINE_INTERFACE} ${PUBLIC_IP} ${RTPENGINE_NG_PORT} ${RTP_MIN} ${RTP_MAX}' < "${TEMPLATE_SRC}" > "${OUT_CFG}"
elif [ -f /config/rtpengine.conf ]; then
  cp /config/rtpengine.conf "${OUT_CFG}"
else
  echo "rtpengine wrapper: missing /config/rtpengine.conf.template and /config/rtpengine.conf" >&2
  exit 1
fi

exec /entrypoint.sh "$@"
