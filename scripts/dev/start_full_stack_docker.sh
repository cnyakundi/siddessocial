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

# sd_340: Persist chosen ports so subsequent shells (and host-run frontend) keep working.
# - Updates ops/docker/.env with the chosen SIDDES_* ports and NEXT_PUBLIC_API_BASE.
# - Upserts frontend/.env.local with SD_INTERNAL_API_BASE + NEXT_PUBLIC_API_BASE for Next API proxying.

persist_kv () {
  python3 - <<'PY2'
import os, re
from pathlib import Path

file = Path(os.environ.get('SD340_FILE','').strip())
key  = os.environ.get('SD340_KEY','').strip()
val  = os.environ.get('SD340_VAL','').strip()

if not str(file):
    raise SystemExit('sd_340: SD340_FILE missing')
if not key:
    raise SystemExit('sd_340: SD340_KEY missing')

text = file.read_text(encoding='utf-8') if file.exists() else ''
pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
line = f"{key}={val}"

if pat.search(text):
    text = pat.sub(line, text)
else:
    if text and not text.endswith('\n'):
        text += '\n'
    text += line + '\n'

file.parent.mkdir(parents=True, exist_ok=True)
file.write_text(text, encoding='utf-8')
PY2
}

# Update ops/docker/.env (Compose env_file)
if [[ -f "ops/docker/.env" ]]; then
  SD340_FILE="ops/docker/.env" SD340_KEY="SIDDES_FRONTEND_PORT" SD340_VAL="${SIDDES_FRONTEND_PORT}" persist_kv
  SD340_FILE="ops/docker/.env" SD340_KEY="SIDDES_BACKEND_PORT"  SD340_VAL="${SIDDES_BACKEND_PORT}"  persist_kv
  SD340_FILE="ops/docker/.env" SD340_KEY="NEXT_PUBLIC_API_BASE"  SD340_VAL="http://localhost:${SIDDES_BACKEND_PORT}" persist_kv
fi

# Upsert frontend/.env.local (Next reads this in dev + build/start)
SD_ENV_LOCAL="frontend/.env.local"
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SD_INTERNAL_API_BASE" SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="NEXT_PUBLIC_API_BASE"  SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SIDDES_BACKEND_PORT"   SD340_VAL="${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SIDDES_FRONTEND_PORT"  SD340_VAL="${SIDDES_FRONTEND_PORT}" persist_kv

# sd_340: Persist chosen ports so subsequent shells (and host-run frontend) keep working.
# - Updates ops/docker/.env with the chosen SIDDES_* ports and NEXT_PUBLIC_API_BASE.
# - Upserts frontend/.env.local with SD_INTERNAL_API_BASE + NEXT_PUBLIC_API_BASE for Next API proxying.

persist_kv () {
  python3 - <<'PY2'
import os, re
from pathlib import Path

file = Path(os.environ.get('SD340_FILE','').strip())
key  = os.environ.get('SD340_KEY','').strip()
val  = os.environ.get('SD340_VAL','').strip()

if not str(file):
    raise SystemExit('sd_340: SD340_FILE missing')
if not key:
    raise SystemExit('sd_340: SD340_KEY missing')

text = file.read_text(encoding='utf-8') if file.exists() else ''
pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
line = f"{key}={val}"

if pat.search(text):
    text = pat.sub(line, text)
else:
    if text and not text.endswith('\n'):
        text += '\n'
    text += line + '\n'

file.parent.mkdir(parents=True, exist_ok=True)
file.write_text(text, encoding='utf-8')
PY2
}

# Update ops/docker/.env (Compose env_file)
if [[ -f "ops/docker/.env" ]]; then
  SD340_FILE="ops/docker/.env" SD340_KEY="SIDDES_FRONTEND_PORT" SD340_VAL="${SIDDES_FRONTEND_PORT}" persist_kv
  SD340_FILE="ops/docker/.env" SD340_KEY="SIDDES_BACKEND_PORT"  SD340_VAL="${SIDDES_BACKEND_PORT}"  persist_kv
  SD340_FILE="ops/docker/.env" SD340_KEY="NEXT_PUBLIC_API_BASE"  SD340_VAL="http://localhost:${SIDDES_BACKEND_PORT}" persist_kv
fi

# Upsert frontend/.env.local (Next reads this in dev + build/start)
SD_ENV_LOCAL="frontend/.env.local"
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SD_INTERNAL_API_BASE" SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="NEXT_PUBLIC_API_BASE"  SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SIDDES_BACKEND_PORT"   SD340_VAL="${SIDDES_BACKEND_PORT}" persist_kv
SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SIDDES_FRONTEND_PORT"  SD340_VAL="${SIDDES_FRONTEND_PORT}" persist_kv

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