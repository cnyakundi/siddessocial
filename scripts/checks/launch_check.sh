#!/usr/bin/env bash
set -euo pipefail

# scripts/checks/launch_check.sh
# One-command launch gate:
# - no fake surfaces
# - backend launch_check (in docker)
# - frontend typecheck/build (best-effort)

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Siddes launch gate =="
echo "Root: $ROOT"
echo ""

echo "-> no_fake_surface_check"
bash scripts/checks/no_fake_surface_check.sh
echo ""

COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "❌ Docker Compose not found. Install Docker Desktop / docker compose." 1>&2
  exit 1
fi

if [[ ! -f "ops/docker/docker-compose.dev.yml" ]]; then
  echo "❌ Missing ops/docker/docker-compose.dev.yml" 1>&2
  exit 1
fi

# Ensure docker env file exists (dev compose expects it)
if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
  cp ops/docker/.env.example ops/docker/.env || true
fi

echo "-> backend: manage.py launch_check (docker)"
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py launch_check --strict
echo ""

if [[ -d "frontend" && -f "frontend/package.json" ]]; then
  echo "-> frontend: typecheck + build"
  pushd frontend >/dev/null
  if command -v npm >/dev/null 2>&1; then
    npm run typecheck || true
    npm run build || true
  else
    echo "⚠️ npm not found; skipping frontend build checks"
  fi
  popd >/dev/null
else
  echo "⚠️ frontend/ missing; skipping frontend checks"
fi

echo ""
echo "✅ launch_check completed."
