SHELL := /bin/sh
COMPOSE := docker compose

.PHONY: up down restart logs ps clean fresh check render help setup health test-push rebuild-push kam-check

help:
	@echo "WebRTC SBC - Available Commands:"
	@echo ""
	@echo "  make setup          - Initial setup (generate VAPID keys)"
	@echo "  make check          - Verify configuration and requirements"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - Show logs from all services"
	@echo "  make ps             - Show container status"
	@echo "  make health         - Check health of all services"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make fresh          - Clean rebuild and start"
	@echo "  make rebuild-push   - Rebuild push-server only"
	@echo "  make test-push      - Send test push notification"
	@echo "  make kam-check      - Validate Kamailio config syntax"
	@echo ""

setup:
	@./scripts/setup.sh

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

rebuild-push:
	@echo "Rebuilding push-server..."
	@$(COMPOSE) build push-server
	@$(COMPOSE) up -d push-server
	@echo "✓ Push-server rebuilt and restarted"

health:
	@echo "Checking service health..."
	@echo ""
	@echo "Push Server:"
	@curl -s http://localhost:3001/health | jq 2>/dev/null || echo "  ❌ Not responding"
	@echo ""
	@echo "Container Status:"
	@$(COMPOSE) ps
	@echo ""

test-push:
ifndef EXTENSION
	@echo "Error: EXTENSION variable required"
	@echo "Usage: make test-push EXTENSION=1001"
else
	@echo "Sending test notification to extension $(EXTENSION)..."
	@curl -X POST http://localhost:3001/api/push/notify \
		-H "Content-Type: application/json" \
		-d '{"extension":"$(EXTENSION)","from":"Test","title":"Test Incoming Call"}' | jq 2>/dev/null
endif

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
	: "${VAPID_PUBLIC_KEY:?Missing VAPID_PUBLIC_KEY}"; \
	: "${VAPID_PRIVATE_KEY:?Missing VAPID_PRIVATE_KEY}"; \
	: "${VAPID_SUBJECT:?Missing VAPID_SUBJECT}"; \
	if [ ! -f certs/fullchain.pem ] || [ ! -f certs/privkey.pem ]; then \
	  echo "Missing certs/fullchain.pem or certs/privkey.pem"; exit 1; \
	fi; \
	for f in \
	  coturn/turnserver.conf.template \
	  rtpengine/rtpengine.conf.template \
	  kamailio/local.cfg.template \
	  nginx/phone.srve.cc.conf.template \
	  www/index.html.template \
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
	  nginx/phone.srve.cc.conf.template \
	  www/index.html.template; do \
	  if [ ! -f $$f ]; then echo "Missing $$f"; exit 1; fi; \
	done; \
	VARS='$${DOMAIN} $${PUBLIC_IP} $${PBX_IP} $${PBX_PORT} $${TURN_USER} $${TURN_PASS} $${TURN_RELAY_IP} $${RTP_MIN} $${RTP_MAX} $${DIAL_MAX_DIGITS}'; \
	envsubst "$$VARS" < coturn/turnserver.conf.template > coturn/turnserver.conf; \
	envsubst "$$VARS" < rtpengine/rtpengine.conf.template > rtpengine/rtpengine.conf; \
	envsubst "$$VARS" < kamailio/local.cfg.template > kamailio/local.cfg; \
	envsubst "$$VARS" < nginx/phone.srve.cc.conf.template > nginx/phone.srve.cc.conf; \
	envsubst "$$VARS" < www/index.html.template > www/index.html; \
	for f in coturn/turnserver.conf rtpengine/rtpengine.conf kamailio/local.cfg nginx/phone.srve.cc.conf www/index.html; do \
	  if grep -qF '$${' $$f; then echo "Unrendered variables remain in $$f"; exit 1; fi; \
	done; \
	echo "Rendered configs from templates"

kam-check:
	@echo "Validating Kamailio config..."
	@docker exec kamailio kamailio -c -f /etc/kamailio/kamailio.cfg >/tmp/kam-check.log 2>&1 || (cat /tmp/kam-check.log; exit 1)
	@echo "OK: Kamailio config is valid"
