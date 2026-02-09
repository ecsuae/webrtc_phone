SHELL := /bin/sh
COMPOSE := docker compose

.PHONY: up down restart logs ps clean fresh check render

up: render
	$(COMPOSE) up -d

restart:
	$(COMPOSE) restart

down:
	$(COMPOSE) down --remove-orphans

clean:
	$(COMPOSE) down -v --remove-orphans

fresh: clean render up

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

check:
	@set -e; \
	if [ ! -f .env ]; then echo "Missing .env"; exit 1; fi; \
	. ./.env; \
	: "${DOMAIN:?Missing DOMAIN}"; \
	: "${PUBLIC_IP:?Missing PUBLIC_IP}"; \
	: "${PBX_IP:?Missing PBX_IP}"; \
	: "${PBX_PORT:?Missing PBX_PORT}"; \
	: "${TURN_USER:?Missing TURN_USER}"; \
	: "${TURN_PASS:?Missing TURN_PASS}"; \
	: "${RTP_MIN:?Missing RTP_MIN}"; \
	: "${RTP_MAX:?Missing RTP_MAX}"; \
	if [ ! -f certs/fullchain.pem ] || [ ! -f certs/privkey.pem ]; then \
	  echo "Missing certs/fullchain.pem or certs/privkey.pem"; exit 1; \
	fi; \
	for f in \
	  coturn/turnserver.conf.template \
	  rtpengine/rtpengine.conf.template \
	  kamailio/local.cfg.template \
	  nginx/phone.srve.cc.conf.template \
	  scripts/render-coturn.sh \
	  scripts/render-rtpengine.sh \
	  scripts/render-kamailio.sh \
	  scripts/render-nginx.sh; do \
	  if [ ! -f $$f ]; then echo "Missing $$f"; exit 1; fi; \
	done; \
	for p in 80 443 5060 3478 5349; do \
	  if ss -lntup 2>/dev/null | grep -q ":$$p "; then \
	    echo "Port $$p already in use"; exit 1; \
	  fi; \
	done; \
	echo "OK: env, certs, templates, and ports look good"

render:
	@set -e; \
	if ! command -v envsubst >/dev/null 2>&1; then \
	  echo "envsubst is required. Install with: apt-get install -y gettext-base"; \
	  exit 1; \
	fi; \
	if [ ! -f .env ]; then echo "Missing .env"; exit 1; fi; \
	set -a; . ./.env; set +a; \
	for f in \
	  coturn/turnserver.conf.template \
	  rtpengine/rtpengine.conf.template \
	  kamailio/local.cfg.template \
	  nginx/phone.srve.cc.conf.template; do \
	  if [ ! -f $$f ]; then echo "Missing $$f"; exit 1; fi; \
	done; \
	VARS='$${DOMAIN} $${PUBLIC_IP} $${PBX_IP} $${PBX_PORT} $${TURN_USER} $${TURN_PASS} $${TURN_RELAY_IP} $${RTP_MIN} $${RTP_MAX}'; \
	envsubst "$$VARS" < coturn/turnserver.conf.template > coturn/turnserver.conf; \
	envsubst "$$VARS" < rtpengine/rtpengine.conf.template > rtpengine/rtpengine.conf; \
	envsubst "$$VARS" < kamailio/local.cfg.template > kamailio/local.cfg; \
	envsubst "$$VARS" < nginx/phone.srve.cc.conf.template > nginx/phone.srve.cc.conf; \
	for f in coturn/turnserver.conf rtpengine/rtpengine.conf kamailio/local.cfg nginx/phone.srve.cc.conf; do \
	  if grep -qF '$${' $$f; then echo "Unrendered variables remain in $$f"; exit 1; fi; \
	done; \
	echo "Rendered configs from templates"
