#!/bin/sh
set -eu

TEMPLATE_SRC="/config/site.conf.template"
OUT_CONF="/etc/nginx/conf.d/default.conf"

RELOAD_DIR="/var/run/certbot-reload"

if [ ! -f "$TEMPLATE_SRC" ]; then
  echo "nginx wrapper: missing template: $TEMPLATE_SRC" >&2
  exit 1
fi

if [ -z "${DOMAIN:-}" ]; then
  echo "nginx wrapper: DOMAIN env var is required to render nginx template" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "nginx wrapper: envsubst not found (required to render nginx template)" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "nginx wrapper: openssl not found (required for temporary self-signed cert bootstrap)" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_CONF")"

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_FULLCHAIN="${CERT_DIR}/fullchain.pem"
CERT_PRIVKEY="${CERT_DIR}/privkey.pem"
BOOTSTRAP_MARKER="${CERT_DIR}/.bootstrap-self-signed"

mkdir -p "$CERT_DIR" "$RELOAD_DIR"

if [ ! -f "$CERT_FULLCHAIN" ] || [ ! -f "$CERT_PRIVKEY" ]; then
  echo "nginx wrapper: real cert not found for ${DOMAIN}; generating temporary self-signed cert"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_PRIVKEY" \
    -out "$CERT_FULLCHAIN" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
  : > "$BOOTSTRAP_MARKER"
elif [ ! -f "$BOOTSTRAP_MARKER" ]; then
  ISSUER_DN="$(openssl x509 -in "$CERT_FULLCHAIN" -noout -issuer 2>/dev/null | sed 's/^issuer=//' || true)"
  SUBJECT_DN="$(openssl x509 -in "$CERT_FULLCHAIN" -noout -subject 2>/dev/null | sed 's/^subject=//' || true)"
  if [ -n "$ISSUER_DN" ] && [ "$ISSUER_DN" = "$SUBJECT_DN" ]; then
    : > "$BOOTSTRAP_MARKER"
  fi
fi

export DOMAIN
envsubst '${DOMAIN} ${KAMAILIO_WS_PORT} ${PUSH_SERVER_PORT}' < "$TEMPLATE_SRC" > "$OUT_CONF"

if grep -q '\${DOMAIN}' "$OUT_CONF"; then
  echo "nginx wrapper: template render incomplete (DOMAIN token still present)" >&2
  exit 1
fi

reload_watcher() {
  while :; do
    if find "$RELOAD_DIR" -mindepth 1 -maxdepth 1 -type f 2>/dev/null | grep -q .; then
      if [ -f /var/run/nginx.pid ]; then
        nginx -t && nginx -s reload || true
      fi
      rm -f "$RELOAD_DIR"/* 2>/dev/null || true
    fi
    sleep 2
  done
}

reload_watcher &

exec nginx -g 'daemon off;'
