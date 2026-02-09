#!/bin/sh
set -e
if ! command -v envsubst >/dev/null 2>&1; then
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache gettext >/dev/null
  else
    apt-get update >/dev/null && apt-get install -y gettext-base >/dev/null
  fi
fi

envsubst < /opt/templates/rtpengine.conf.template > /etc/rtpengine/rtpengine.conf
