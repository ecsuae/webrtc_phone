#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
  echo "certbot-init: DOMAIN is required" >&2
  exit 1
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "certbot-init: LETSENCRYPT_EMAIL is required" >&2
  exit 1
fi

CERT_FULLCHAIN="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
CERT_PRIVKEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
BOOTSTRAP_MARKER="/etc/letsencrypt/live/${DOMAIN}/.bootstrap-self-signed"

if [ -f "$CERT_FULLCHAIN" ] && [ -f "$CERT_PRIVKEY" ]; then
  if [ -f "$BOOTSTRAP_MARKER" ]; then
    echo "certbot-init: bootstrap self-signed cert detected for ${DOMAIN}; replacing with Let's Encrypt cert"
    rm -rf "/etc/letsencrypt/live/${DOMAIN}" "/etc/letsencrypt/archive/${DOMAIN}" "/etc/letsencrypt/renewal/${DOMAIN}.conf" 2>/dev/null || true
  else
    echo "certbot-init: certificate already exists for ${DOMAIN}; skipping issuance"
    exit 0
  fi
fi

mkdir -p /var/www/certbot/.well-known/acme-challenge /var/run/certbot-reload
printf '%s' ok > /var/www/certbot/.well-known/acme-challenge/ping

python3 - <<'PY'
import os
import sys
import time
from urllib.request import urlopen

domain = os.environ.get("DOMAIN", "").strip()
url = f"http://{domain}/.well-known/acme-challenge/ping"
deadline = time.time() + 120

while True:
    try:
        with urlopen(url, timeout=5) as r:
            if r.read(16).strip() == b"ok":
                sys.exit(0)
    except Exception:
        pass

    if time.time() > deadline:
        print(
            f"certbot-init: timeout waiting for nginx HTTP challenge path: {url}",
            file=sys.stderr,
        )
        sys.exit(1)
    time.sleep(2)
PY

STAGING=""
if [ "${LETSENCRYPT_STAGING:-}" = "1" ]; then
  STAGING="--staging"
fi

certbot certonly --non-interactive --agree-tos --no-eff-email \
  --email "${LETSENCRYPT_EMAIL}" \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  ${STAGING}

rm -f "$BOOTSTRAP_MARKER" 2>/dev/null || true
touch /var/run/certbot-reload/reload
