#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: Inbox DM smoke test (DB) =="
echo "Root: ${ROOT}"
echo ""

# If docker is available, prefer docker compose (matches the rest of the repo dev tooling).
if command -v docker >/dev/null 2>&1; then
  COMPOSE=()
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  fi

  if [[ "${#COMPOSE[@]}" -gt 0 && -f "ops/docker/docker-compose.dev.yml" ]]; then
    # Ensure env exists
    if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
      echo "• Creating ops/docker/.env from .env.example"
      cp ops/docker/.env.example ops/docker/.env
    fi

    echo "• Ensuring migrations are applied..."
    bash scripts/dev/django_migrate.sh

    echo ""
    echo "• Running: python manage.py inbox_dm_smoke (inside Docker backend)"
    "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py inbox_dm_smoke

    echo ""
    echo "✅ Smoke test completed."
    exit 0
  fi
fi

# Fallback: run locally (requires your Python env to have Django + DB configured)
PY="${PYTHON:-python3}"
if ! command -v "${PY}" >/dev/null 2>&1; then
  PY="python"
fi

echo "• Docker not available (or compose file missing). Running locally with ${PY}..."
"${PY}" backend/manage.py inbox_dm_smoke
echo "✅ Smoke test completed."
