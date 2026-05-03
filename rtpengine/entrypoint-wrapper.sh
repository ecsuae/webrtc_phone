#!/bin/sh
set -eu

TEMPLATE_SRC="/config/rtpengine.conf.template"
FALLBACK_SRC="/config/rtpengine.conf"
OUT_CFG="/etc/rtpengine.conf"

if [ -f "${TEMPLATE_SRC}" ]; then
  if command -v envsubst >/dev/null 2>&1; then
    envsubst '${RTPENGINE_INTERFACE} ${PUBLIC_IP} ${RTPENGINE_NG_PORT} ${RTP_MIN} ${RTP_MAX}' < "${TEMPLATE_SRC}" > "${OUT_CFG}"
  else
    sed \
      -e "s|\${RTPENGINE_INTERFACE}|${RTPENGINE_INTERFACE}|g" \
      -e "s|\${PUBLIC_IP}|${PUBLIC_IP}|g" \
      -e "s|\${RTPENGINE_NG_PORT}|${RTPENGINE_NG_PORT}|g" \
      -e "s|\${RTP_MIN}|${RTP_MIN}|g" \
      -e "s|\${RTP_MAX}|${RTP_MAX}|g" \
      "${TEMPLATE_SRC}" > "${OUT_CFG}"
  fi
elif [ -f "${FALLBACK_SRC}" ]; then
  cp "${FALLBACK_SRC}" "${OUT_CFG}"
else
  echo "rtpengine wrapper: missing /config/rtpengine.conf.template and /config/rtpengine.conf" >&2
  exit 1
fi

if grep -q '\${[A-Za-z_][A-Za-z0-9_]*}' "${OUT_CFG}" 2>/dev/null; then
  echo "rtpengine wrapper: rendered ${OUT_CFG} still contains unresolved \${...} placeholders" >&2
  exit 1
fi

exec /entrypoint.sh "$@"
