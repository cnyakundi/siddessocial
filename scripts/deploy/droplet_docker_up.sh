#!/usr/bin/env bash
set -euo pipefail

# One-command helper for running Siddes backend on a Droplet using Docker.
# Run from repo root on the droplet.

if [ ! -d "ops/docker" ]; then
  echo "ERROR: run from repo root (must contain ops/docker)." >&2
  exit 1
fi

ENV_FILE="ops/docker/.env.prod"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing $ENV_FILE" >&2
  echo "Create it by copying ops/docker/.env.prod.example -> ops/docker/.env.prod and filling values." >&2
  exit 1
fi

echo "== Siddes Droplet Docker (prod) =="

echo "Using env: $ENV_FILE"

docker compose --env-file "$ENV_FILE" -f ops/docker/docker-compose.prod.yml up -d --build

echo "OK: containers are up. Useful commands:"
cat <<'HELP'
  docker compose --env-file ops/docker/.env.prod -f ops/docker/docker-compose.prod.yml ps
  docker compose --env-file ops/docker/.env.prod -f ops/docker/docker-compose.prod.yml logs -f --tail=200 backend
  docker compose --env-file ops/docker/.env.prod -f ops/docker/docker-compose.prod.yml logs -f --tail=200 caddy

Health checks:
  curl -i https://api.siddes.com/healthz
  curl -i https://api.siddes.com/readyz
HELP
