#!/bin/sh
set -eu

TEMPLATE_SRC="/config/phone.srve.cc.conf.template"
OUT_CONF="/etc/nginx/conf.d/default.conf"

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

mkdir -p "$(dirname "$OUT_CONF")"

# Render the repo-owned template into the live nginx config path.
# Keep rendering narrow to avoid unintentionally substituting nginx runtime vars.
# (The template currently only requires ${DOMAIN}.)
export DOMAIN
envsubst '${DOMAIN}' < "$TEMPLATE_SRC" > "$OUT_CONF"

# Basic sanity check: ensure we did not leave a dangling token.
if grep -q '\${DOMAIN}' "$OUT_CONF"; then
  echo "nginx wrapper: template render incomplete (DOMAIN token still present)" >&2
  exit 1
fi

# Optional: print a single-line confirmation for container logs.
echo "nginx wrapper: rendered $OUT_CONF from template (DOMAIN=$DOMAIN)" >&2

exec nginx -g 'daemon off;'
