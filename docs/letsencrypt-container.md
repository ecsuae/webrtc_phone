# Let’s Encrypt (certbot) in Docker

## Purpose
Issue and renew TLS certificates using Docker only.
- Domain is taken from `.env` via `DOMAIN`.
- Email is taken from `.env` via `LETSENCRYPT_EMAIL`.
- Staging toggle is taken from `.env` via `LETSENCRYPT_STAGING`.

`.env` must never be committed unless you intentionally choose a private-repo deployment policy.

## Shared paths
Certificates and ACME challenges are stored in bind mounts:
- `./data/certbot/conf:/etc/letsencrypt`
- `./data/certbot/www:/var/www/certbot`

Nginx serves `/.well-known/acme-challenge/` from `/var/www/certbot`.

## Required `.env` variables
Add these to `.env.example` (placeholders) and set real values in your local `.env`:

```dotenv
DOMAIN=app.example.com
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_STAGING=1
```

`LETSENCRYPT_STAGING=1` uses Let’s Encrypt staging (safe for testing). Set to `0` for production issuance.

## Nginx HTTP-01 behavior
Nginx must:
- Listen on port 80.
- Serve `/.well-known/acme-challenge/` from `/var/www/certbot`.
- Continue existing proxy/WebSocket behavior unchanged for all other paths.

## Certbot services
This stack uses the official certbot Docker image:
- `certbot-init` runs automatically on `docker compose up -d` and performs first issuance if no cert exists yet.
- `certbot-renew` runs continuously and attempts renewals every 12 hours.

Neither service mounts the Docker socket.

## Fully automatic bootstrap and renewal
Nginx must be able to start even on a fresh clone where real certificates do not exist yet.

This stack uses a Docker-only bootstrap flow:
- Nginx starts with a temporary self-signed certificate if `/etc/letsencrypt/live/${DOMAIN}/` is missing and writes a marker file: `/etc/letsencrypt/live/${DOMAIN}/.bootstrap-self-signed`.
- Nginx serves HTTP-01 challenges from `/var/www/certbot`.
- `certbot-init` replaces the temporary self-signed cert if the marker file exists, then waits for `http://${DOMAIN}/.well-known/acme-challenge/ping` to be reachable, then issues the real certificate via `--webroot`.
- After issuance/renewal, certbot touches a reload flag in `./data/certbot/reload`.
- Nginx runs a small watcher process that reloads nginx when it sees the reload flag.

Operator workflow:
```bash
cp .env.example .env
$EDITOR .env
docker compose up -d
```

Isolated testing (avoid starting the full stack):
```bash
docker compose up -d --no-deps nginx
docker compose up -d --no-deps certbot-init certbot-renew
```
