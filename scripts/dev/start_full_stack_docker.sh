#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: start full stack (Docker) =="
echo "Root: ${ROOT}"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found."
  echo "Install Docker Desktop first, then re-run:"
  echo "  ./scripts/dev/start_full_stack_docker.sh"
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

port_in_use () {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  # Fallback: try to bind via python (best effort)
  # FIX: Passed "${port}" as argument BEFORE the heredoc
  if command -v python3 >/dev/null 2>&1; then
    python3 - "${port}" <<PY >/dev/null 2>&1
import socket, sys
p=int(sys.argv[1])
s=socket.socket()
try:
    s.bind(("127.0.0.1", p))
except OSError:
    sys.exit(0)  # in use
finally:
    try: s.close()
    except: pass
sys.exit(1)  # free
PY
    return $?
  fi

  return 1
}

choose_free_port () {
  local start="$1"
  local end="$2"
  local p
  for ((p=start; p<=end; p++)); do
    if ! port_in_use "${p}"; then
      echo "${p}"
      return 0
    fi
  done
  return 1
}

# Ensure env file exists (safe, non-destructive)
if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
  echo "• Creating ops/docker/.env from .env.example"
  cp ops/docker/.env.example ops/docker/.env
fi

# Choose ports (auto-fix if 3000/8000 are busy)
DEFAULT_FRONTEND_PORT="${SIDDES_FRONTEND_PORT:-3000}"
DEFAULT_BACKEND_PORT="${SIDDES_BACKEND_PORT:-8000}"

FRONTEND_PORT="$(choose_free_port "${DEFAULT_FRONTEND_PORT}" 3010 || true)"
BACKEND_PORT="$(choose_free_port "${DEFAULT_BACKEND_PORT}" 8010 || true)"

if [[ -z "${FRONTEND_PORT}" ]]; then
  echo "❌ Could not find a free frontend port in range ${DEFAULT_FRONTEND_PORT}-3010"
  exit 1
fi
if [[ -z "${BACKEND_PORT}" ]]; then
  echo "❌ Could not find a free backend port in range ${DEFAULT_BACKEND_PORT}-8010"
  exit 1
fi

export SIDDES_FRONTEND_PORT="${FRONTEND_PORT}"
export SIDDES_BACKEND_PORT="${BACKEND_PORT}"
export NEXT_PUBLIC_API_BASE="http://localhost:${SIDDES_BACKEND_PORT}"

echo "• Using ports:"
echo "  - Frontend: ${SIDDES_FRONTEND_PORT}"
echo "  - Backend:  ${SIDDES_BACKEND_PORT}"
echo ""

# Cleanly stop any previous dev stack (does NOT delete the DB volume)
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml down >/dev/null 2>&1 || true

echo "• Starting services (db, redis, backend, frontend) in the background..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up --build -d

echo ""
echo "URLs:"
echo "  Frontend: http://localhost:${SIDDES_FRONTEND_PORT}"
echo "  Backend:  http://localhost:${SIDDES_BACKEND_PORT}/healthz"
echo ""
echo "Useful commands:"
echo "  View logs:  ${COMPOSE[*]} -f ops/docker/docker-compose.dev.yml logs -f"
echo "  Stop:       ${COMPOSE[*]} -f ops/docker/docker-compose.dev.yml down"