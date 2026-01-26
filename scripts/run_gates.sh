#!/usr/bin/env bash
set -euo pipefail

# scripts/run_gates.sh
# "Fast truth" gate:
# - frontend typecheck + build
# - backend manage.py check (docker)
# - p0 sanity (routes/proxies/http/etc) via scripts/dev/p0_gate.sh
#
# Env knobs:
# - SKIP_HTTP=1    -> skip HTTP smoke inside p0_gate
# - SKIP_CHECKS=1  -> skip optional scripts/checks subset inside p0_gate

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

fail_count=0
say() { echo "[gates] $*"; }

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

if [[ ! -d "frontend" || ! -f "frontend/package.json" ]]; then
  say "ERROR: frontend/ missing"
  exit 1
fi
if [[ ! -d "backend" ]]; then
  say "ERROR: backend/ missing"
  exit 1
fi

say "== Siddes Gates (fast truth) =="

# 1) Frontend typecheck + build
run "Frontend: typecheck" npm -C frontend run typecheck
run "Frontend: build" npm -C frontend run build

# 2) Backend manage.py check (docker)
COMPOSE_FILE="ops/docker/docker-compose.dev.yml"
if command -v docker >/dev/null 2>&1 && [[ -f "${COMPOSE_FILE}" ]]; then
  run "Backend: manage.py check (docker)" docker compose -f "${COMPOSE_FILE}" exec -T backend python manage.py check
else
  say "WARN: docker/compose file not available; skipping backend manage.py check"
fi

# 3) P0 sanity (routes/proxies/http)
if [[ ! -f "scripts/dev/p0_gate.sh" ]]; then
  say "ERROR: missing scripts/dev/p0_gate.sh"
  exit 1
fi
if bash scripts/dev/p0_gate.sh; then
  say "OK: P0 sanity (p0_gate)"
else
  say "FAIL: P0 sanity (p0_gate)"
  fail_count=$((fail_count+1))
fi

if [[ "${fail_count}" -gt 0 ]]; then
  say "FAILED with ${fail_count} issue(s)."
  exit 1
fi

say "✅ Gates passed."
