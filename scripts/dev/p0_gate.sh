#!/usr/bin/env bash
set -euo pipefail

# scripts/dev/p0_gate.sh (v2)
# One-command sanity gate for Siddes (frontend + backend + critical proxies).
#
# Usage:
#   scripts/dev/p0_gate.sh
#   SKIP_HTTP=1 scripts/dev/p0_gate.sh
#   SKIP_CHECKS=1 scripts/dev/p0_gate.sh
#
# What it checks:
# - Frontend lint
# - Backend: no pending migrations (makemigrations --check)
# - Backend: py_compile on critical modules
# - Static sanity: critical Next API routes exist; no sd_viewer cookie-instruction UI; no x-sd-viewer forwarding in prod
# - Optional HTTP smoke (requires running frontend at localhost:${SIDDES_FRONTEND_PORT:-3000})

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="ops/docker/docker-compose.dev.yml"
FRONTEND_PORT="${SIDDES_FRONTEND_PORT:-}"


detect_frontend_port() {
  local hint="${1:-}"
  if [[ -n "${hint}" ]]; then
    echo "${hint}"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    local out=""
    out="$(docker compose -f "${COMPOSE_FILE}" port frontend 3000 2>/dev/null | tail -n 1 || true)"
    if [[ "${out}" =~ :([0-9]+)$ ]]; then
      echo "${BASH_REMATCH[1]}"
      return 0
    fi
  fi

  echo "3000"
}

FRONTEND_PORT="$(detect_frontend_port "${FRONTEND_PORT:-}")"


# sd_270: autodetect the mapped host port from docker-compose when SIDDES_FRONTEND_PORT is not exported
if [[ -z "${FRONTEND_PORT}" ]]; then
  if command -v docker >/dev/null 2>&1; then
    mapped=$(docker compose -f "${COMPOSE_FILE}" port frontend 3000 2>/dev/null | head -n 1 || true)
    port="${mapped##*:}"
    if [[ "${port}" =~ ^[0-9]+$ ]]; then
      FRONTEND_PORT="${port}"
    else
      FRONTEND_PORT="3000"
    fi
  else
    FRONTEND_PORT="3000"
  fi
fi
say() { echo "[p0_gate] $*"; }

fail_count=0
run() {
  local label="$1"; shift
  say "${label}"
  if "$@"; then
    say "OK: ${label}"
  else
    say "FAIL: ${label}"
    fail_count=$((fail_count+1))
  fi
}

# ---- Static checks (fast, no docker) ----

run "Repo: ops/docker/.env.example exists (recommended)" bash -lc 'test -f ops/docker/.env.example'

run "Frontend: critical Next API routes exist" bash -lc '
  test -f frontend/src/app/api/invites/route.ts && \
  test -f frontend/src/app/api/invites/[id]/route.ts && \
  test -f frontend/src/app/api/circles/[id]/route.ts && \
  test -f frontend/src/app/api/inbox/thread/[id]/route.ts && \
  test -f frontend/src/app/api/inbox/threads/route.ts && \
  test -f frontend/src/app/api/notifications/route.ts && \
  test -f frontend/src/app/api/broadcasts/route.ts
'

run "Frontend: no sd_viewer cookie-instruction UI remains on Circles" bash -lc '
  ! grep -R -n "sd_viewer is missing" frontend/src/app/siddes-circles >/dev/null 2>&1 && \
  ! grep -R -n "document\\.cookie = \\\"sd_viewer=me" frontend/src/app/siddes-circles >/dev/null 2>&1
'

run "Frontend: auth proxy never forwards x-sd-viewer in production" bash -lc '
  grep -R -n "allowDevViewer" frontend/src/app/api/auth/_proxy.ts >/dev/null 2>&1 && \
  grep -R -n "NODE_ENV !== \"production\"" frontend/src/app/api/auth/_proxy.ts >/dev/null 2>&1
'

# ---- Frontend lint ----
run "Frontend: lint" npm -C frontend run lint

# ---- Backend checks (docker compose) ----
if ! command -v docker >/dev/null 2>&1; then
  say "ERROR: docker not found"
  exit 1
fi

# ensure compose file exists
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  say "ERROR: missing compose file: ${COMPOSE_FILE}"
  exit 1
fi

run "Docker: compose ps" docker compose -f "${COMPOSE_FILE}" ps

run "Backend: makemigrations --check" docker compose -f "${COMPOSE_FILE}" exec backend python manage.py makemigrations --check

run "Backend: py_compile critical modules" docker compose -f "${COMPOSE_FILE}" exec backend python -m py_compile \
  siddes_backend/settings.py \
  siddes_backend/csrf.py \
  siddes_backend/identity.py \
  siddes_post/views.py \
  siddes_feed/feed_stub.py \
  siddes_sets/store_db.py \
  siddes_invites/store_db.py \
  siddes_inbox/store_db.py \
  siddes_broadcasts/views.py \
  siddes_notifications/views.py

# ---- Optional check scripts (fast subset) ----
if [[ "${SKIP_CHECKS:-0}" != "1" ]] && [[ -d scripts/checks ]]; then
  for f in \
    scripts/checks/internal_api_base_check.sh \
    scripts/checks/next_api_proxy_forwards_cookie_check.sh \
    scripts/checks/auth_bootstrap_check.sh \
    scripts/checks/inbox_provider_check.sh \
    scripts/checks/sets_provider_check.sh \
    scripts/checks/notifications_check.sh \
    scripts/checks/observability_baseline_check.sh
  do
    if [[ -f "$f" ]]; then
      run "Check: $f" bash "$f"
    else
      say "SKIP (missing): $f"
    fi
  done
fi

# ---- Optional HTTP smoke ----
if [[ "${SKIP_HTTP:-0}" == "1" ]]; then
  say "HTTP smoke: skipped (SKIP_HTTP=1)"
else
  say "HTTP smoke (frontend must be running on :${FRONTEND_PORT})"
  endpoints=(
    "/api/auth/me"
    "/api/feed?side=public"
    "/api/circles?side=public"
    "/api/invites?direction=incoming"
    "/api/inbox/threads?side=public"
    "/api/notifications"
    "/api/broadcasts?tab=following"
  )

  for ep in "${endpoints[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}${ep}" || true)
    say "GET ${ep} -> ${code}"

    # unreachable
    if [[ "${code}" == "000" ]]; then
      say "ERROR: frontend not reachable at http://localhost:${FRONTEND_PORT} (start it or set SKIP_HTTP=1)"
      fail_count=$((fail_count+1))
      continue
    fi

    # hard failures
    if [[ "${code}" == "500" ]] || [[ "${code}" == "404" ]]; then
      say "ERROR: ${ep} returned ${code}"
      fail_count=$((fail_count+1))
      continue
    fi
  done
fi

if [[ "${fail_count}" -gt 0 ]]; then
  say "FAILED with ${fail_count} issue(s)."
  exit 1
fi

say "OK"
