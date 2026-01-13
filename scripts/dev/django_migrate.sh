#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: Django migrate (Docker) =="
echo "Root: ${ROOT}"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop, then re-run:"
  echo "  bash scripts/dev/django_migrate.sh"
  exit 1
fi

COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "❌ Docker Compose not available."
  exit 1
fi

# Ensure env file exists (safe, non-destructive)
if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
  echo "• Creating ops/docker/.env from .env.example"
  cp ops/docker/.env.example ops/docker/.env
fi

echo "• Ensuring db is up..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up -d db >/dev/null

echo "• Running migrations..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py migrate

echo ""
echo "✅ Migrations complete"
