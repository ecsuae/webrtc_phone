FROM ghcr.io/kamailio/kamailio:5.8.2-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends gettext-base \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint-wrapper.sh /entrypoint-wrapper.sh

ENTRYPOINT ["/bin/sh", "/entrypoint-wrapper.sh"]
