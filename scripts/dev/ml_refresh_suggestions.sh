#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: ML suggestions refresh (Phase 0) =="
echo "Root: ${ROOT}"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop then re-run."
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

# Ensure migrations run
bash scripts/dev/django_migrate.sh

echo "• Refreshing suggestions (viewer=auto)…"
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py ml_refresh_suggestions --reset --viewer=auto

echo ""
echo "✅ Done."
echo "Tip: run onboarding -> match contacts to generate contact-based suggestions too."
