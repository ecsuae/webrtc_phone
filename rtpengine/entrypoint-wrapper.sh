#!/bin/sh
set -eu
cp /config/rtpengine.conf /etc/rtpengine.conf
exec /entrypoint.sh "$@"
