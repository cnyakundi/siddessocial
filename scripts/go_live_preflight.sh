#!/usr/bin/env bash
set -euo pipefail

# Local preflight checks (safe, non-destructive)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Siddes Go-Live Preflight =="
echo "Repo: ${ROOT_DIR}"

echo
echo "[1/3] Frontend typecheck + build"
cd "${ROOT_DIR}/frontend"
npm run typecheck
npm run build

cd "${ROOT_DIR}"

echo
echo "[2/3] Backend sanity (compile)"
if command -v python3 >/dev/null 2>&1; then
  (cd backend && python3 -m compileall -q .) || true
else
  echo "python3 not found on host (ok if you use docker)."
fi

echo
echo "[3/3] Backend checks via docker (optional)"
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if [ -f "${ROOT_DIR}/ops/docker/docker-compose.dev.yml" ]; then
      docker compose -f ops/docker/docker-compose.dev.yml exec -T backend python manage.py check || true
      docker compose -f ops/docker/docker-compose.dev.yml exec -T backend python manage.py showmigrations || true
      echo "(docker) health endpoints:"
      echo "  curl -i http://localhost:8000/healthz"
      echo "  curl -i http://localhost:8000/readyz"
    else
      echo "docker-compose.dev.yml not found; skipping."
    fi
  else
    echo "Docker is installed but not running; skipping docker checks."
  fi
else
  echo "Docker not installed; skipping docker checks."
fi

echo
echo "Preflight finished. If frontend build succeeded, you are close to go-live."
