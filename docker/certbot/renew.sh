#!/bin/sh
set -eu

mkdir -p /var/run/certbot-reload

while :; do
  OUT="$(certbot renew --webroot -w /var/www/certbot 2>&1 || true)"
  echo "$OUT"

  echo "$OUT" | grep -q "No renewals were attempted" || touch /var/run/certbot-reload/reload

  sleep 12h
done
