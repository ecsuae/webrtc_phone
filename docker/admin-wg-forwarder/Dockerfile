FROM nginx:alpine

RUN apk add --no-cache gettext curl

COPY admin-forwarder.conf.template /config/admin-forwarder.conf.template
COPY forwarder.sh /forwarder.sh

EXPOSE 8081

ENTRYPOINT ["/bin/sh", "/forwarder.sh"]
