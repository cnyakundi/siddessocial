#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

say(){ echo "$*"; }
fail(){ echo "❌ $*"; exit 1; }

PY="python3"
command -v "$PY" >/dev/null 2>&1 || PY="python"
command -v "$PY" >/dev/null 2>&1 || fail "python3 required"

command -v npm >/dev/null 2>&1 || fail "npm required"
command -v curl >/dev/null 2>&1 || fail "curl required"

port_in_use () {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  "$PY" - "${port}" <<'PY' >/dev/null 2>&1
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

wait_http_200 () {
  local url="$1"
  local tries="${2:-60}"
  local i=0
  while [[ "$i" -lt "$tries" ]]; do
    if curl -fsS -o /dev/null "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  return 1
}

USERNAME="${SD_PERF_USERNAME:-perf}"
EMAIL="${SD_PERF_EMAIL:-perf@example.com}"
PASSWORD="${SD_PERF_PASSWORD:-perf_pass_12345}"

MODE="host"
if [[ "${SD_PERF_FORCE_HOST:-}" != "1" ]] && command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
    MODE="docker"
  fi
fi

FRONT_PID=""
BACK_PID=""

cleanup() {
  if [[ -n "${FRONT_PID}" ]]; then kill "${FRONT_PID}" >/dev/null 2>&1 || true; fi
  if [[ -n "${BACK_PID}" ]]; then kill "${BACK_PID}" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

BACKEND_PORT="${SIDDES_BACKEND_PORT:-8000}"
FRONTEND_PORT="${SIDDES_FRONTEND_PORT:-3000}"

FRONTEND_PORT="$(choose_free_port "${FRONTEND_PORT}" 3010 || true)"
[[ -n "${FRONTEND_PORT}" ]] || fail "Could not find a free frontend port in 3000-3010"

if [[ "$MODE" == "host" ]]; then
  BACKEND_PORT="$(choose_free_port "${BACKEND_PORT}" 8010 || true)"
  [[ -n "${BACKEND_PORT}" ]] || fail "Could not find a free backend port in 8000-8010"
fi

BACKEND_BASE="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_BASE="http://127.0.0.1:${FRONTEND_PORT}"

say "== Perf budgets (LHCI) =="
say "Mode       : ${MODE}"
say "Backend    : ${BACKEND_BASE}"
say "Frontend   : ${FRONTEND_BASE}"
say ""

# --- Start backend + seed ---
VIEWER_ID=""

if [[ "$MODE" == "docker" ]]; then
  # Ensure env file exists
  if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
    cp ops/docker/.env.example ops/docker/.env
  fi

  # shellcheck disable=SC1091
  source scripts/dev/_autoload_docker_env.sh

  BACKEND_PORT="${SIDDES_BACKEND_PORT:-8000}"
  BACKEND_BASE="http://127.0.0.1:${BACKEND_PORT}"

  COMPOSE=()
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  else
    COMPOSE=(docker-compose)
  fi

  say "• Starting docker backend stack (db, redis, backend)…"
  "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up -d db redis backend >/dev/null

  say "• Running migrations (docker)…"
  bash scripts/dev/django_migrate.sh >/dev/null

  say "• Waiting for backend healthz…"
  wait_http_200 "${BACKEND_BASE}/healthz" 90 || fail "Backend did not become healthy at ${BACKEND_BASE}/healthz"

  say "• Ensuring perf user (docker)…"
  VIEWER_ID="$("${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend \
    python manage.py ensure_perf_user --username "${USERNAME}" --email "${EMAIL}" --password "${PASSWORD}" | tail -n1 | tr -d '\r' | xargs)"

  [[ -n "${VIEWER_ID}" ]] || fail "ensure_perf_user did not return a viewer id"

  say "• Seeding demo universe for ${VIEWER_ID} (docker)…"
  "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend \
    python manage.py seed_demo_universe --reset --viewer "${VIEWER_ID}" >/dev/null

  "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend \
    python manage.py seed_notifications_demo --reset --viewer "${VIEWER_ID}" >/dev/null 2>&1 || true
else
  say "• Migrating (host backend)…"
  "$PY" backend/manage.py migrate >/dev/null

  say "• Ensuring perf user (host)…"
  VIEWER_ID="$("$PY" backend/manage.py ensure_perf_user --username "${USERNAME}" --email "${EMAIL}" --password "${PASSWORD}" | tail -n1 | tr -d '\r' | xargs)"
  [[ -n "${VIEWER_ID}" ]] || fail "ensure_perf_user did not return a viewer id"

  say "• Seeding demo universe for ${VIEWER_ID} (host)…"
  "$PY" backend/manage.py seed_demo_universe --reset --viewer "${VIEWER_ID}" >/dev/null
  "$PY" backend/manage.py seed_notifications_demo --reset --viewer "${VIEWER_ID}" >/dev/null 2>&1 || true

  say "• Starting backend server…"
  DJANGO_DEBUG=1 "$PY" backend/manage.py runserver "127.0.0.1:${BACKEND_PORT}" >/tmp/siddes_perf_backend.log 2>&1 &
  BACK_PID=$!

  say "• Waiting for backend healthz…"
  wait_http_200 "${BACKEND_BASE}/healthz" 90 || fail "Backend did not become healthy at ${BACKEND_BASE}/healthz"
fi

# --- Build + start frontend (production) ---
say ""
say "• Installing frontend deps (if needed)…"
if [[ ! -d "frontend/node_modules" ]] || [[ ! -x "frontend/node_modules/.bin/lhci" ]]; then
  npm -C frontend ci >/dev/null 2>&1 || npm -C frontend install >/dev/null
fi

say "• Building frontend (prod)…"
SD_INTERNAL_API_BASE="${BACKEND_BASE}" NEXT_PUBLIC_API_BASE="${BACKEND_BASE}" \
SIDDES_BACKEND_PORT="${BACKEND_PORT}" SIDDES_FRONTEND_PORT="${FRONTEND_PORT}" \
npm -C frontend run build >/dev/null

say "• Starting frontend (next start)…"
SD_INTERNAL_API_BASE="${BACKEND_BASE}" NEXT_PUBLIC_API_BASE="${BACKEND_BASE}" \
SIDDES_BACKEND_PORT="${BACKEND_PORT}" PORT="${FRONTEND_PORT}" \
npm -C frontend run start >/tmp/siddes_perf_frontend.log 2>&1 &
FRONT_PID=$!

say "• Waiting for frontend…"
wait_http_200 "${FRONTEND_BASE}/login" 90 || fail "Frontend did not become ready at ${FRONTEND_BASE}/login"

# --- Get session cookie ---
say "• Logging in to obtain session cookie…"
LOGIN_JSON="$(curl -sS -H "content-type: application/json" -X POST \
  -d "{\"identifier\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  "${FRONTEND_BASE}/api/auth/login" || true)"

SESSION="$("$PY" - <<'PY' "${LOGIN_JSON}"
import json, sys
raw = sys.argv[1]
try:
  d = json.loads(raw)
except Exception:
  print("")
  raise SystemExit(0)
sess = d.get("session") or {}
print(str(sess.get("value") or "").strip())
PY
)"

[[ -n "${SESSION}" ]] || fail "Could not extract session cookie from /api/auth/login response"

export SD_LHCI_BASE_URL="${FRONTEND_BASE}"
export SD_PERF_VIEWER_ID="${VIEWER_ID}"
export SD_PERF_SESSION_COOKIE="sessionid=${SESSION}"

say ""
say "• Running LHCI budgets…"
npm -C frontend run perf:lhci

say ""
say "✅ Perf budgets complete."
say "Reports: frontend/.lighthouseci/"
