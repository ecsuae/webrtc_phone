#!/bin/sh
set -eu

: "${ADMIN_WG_BIND_HOST:?}"
: "${ADMIN_WG_BIND_PORT:?}"
: "${ADMIN_UPSTREAM_HOST:=push-server}"
: "${ADMIN_UPSTREAM_PORT:=8081}"

wg_if=""
for i in $(seq 1 60); do
  if ip link show wg0 >/dev/null 2>&1; then
    wg_if="wg0"
    break
  fi
  sleep 1
done

if [ -z "${wg_if}" ]; then
  echo "wg0 not found"
  exit 1
fi

for i in $(seq 1 60); do
  if ip -o -4 addr show dev "${wg_if}" | awk '{print $4}' | grep -Fq "${ADMIN_WG_BIND_HOST}/"; then
    break
  fi
  sleep 1
done

if ! ip -o -4 addr show dev "${wg_if}" | awk '{print $4}' | grep -Fq "${ADMIN_WG_BIND_HOST}/"; then
  echo "${ADMIN_WG_BIND_HOST} not present on ${wg_if}"
  ip -o -4 addr show dev "${wg_if}" || true
  exit 1
fi

for i in $(seq 1 60); do
  if getent hosts "${ADMIN_UPSTREAM_HOST}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! getent hosts "${ADMIN_UPSTREAM_HOST}" >/dev/null 2>&1; then
  echo "DNS failed for ${ADMIN_UPSTREAM_HOST}"
  exit 1
fi

for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://${ADMIN_UPSTREAM_HOST}:${ADMIN_UPSTREAM_PORT}/admin/provisioning" || true)"
  if [ "${code}" = "200" ] || [ "${code}" = "403" ]; then
    break
  fi
  sleep 1
done

envsubst '${ADMIN_WG_BIND_HOST} ${ADMIN_WG_BIND_PORT} ${ADMIN_UPSTREAM_HOST} ${ADMIN_UPSTREAM_PORT}' \
  < /config/admin-forwarder.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
