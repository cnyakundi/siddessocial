#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/_autoload_docker_env.sh"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "== Siddes: seed demo universe (Docker) =="
echo "Root: $ROOT"
echo ""

# Ensure env file exists (safe, non-destructive)
if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
  echo "• Creating ops/docker/.env from .env.example"
  cp ops/docker/.env.example ops/docker/.env
fi

COMPOSE=(docker compose)

echo "• Ensuring db is up..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up -d db >/dev/null

echo "• Running migrations..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py migrate

echo "• Seeding demo universe..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py seed_demo_universe --reset --viewer me

echo ""
echo "✅ Seeded demo universe."
echo "Next:"
echo "  - Start stack:  bash scripts/dev/start_full_stack_docker.sh"
echo "  - Open:         http://localhost:${SIDDES_FRONTEND_PORT:-3000}/siddes-feed"
