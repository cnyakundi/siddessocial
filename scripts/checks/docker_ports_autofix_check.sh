#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Docker port auto-fix + env-driven ports =="

COMPOSE_FILE="ops/docker/docker-compose.dev.yml"
START_SCRIPT="scripts/dev/start_full_stack_docker.sh"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "❌ Missing: ${COMPOSE_FILE}"
  exit 1
fi
if [[ ! -f "${START_SCRIPT}" ]]; then
  echo "❌ Missing: ${START_SCRIPT}"
  exit 1
fi

grep -q "SIDDES_FRONTEND_PORT" "${COMPOSE_FILE}" && echo "✅ compose uses SIDDES_FRONTEND_PORT"
grep -q "SIDDES_BACKEND_PORT" "${COMPOSE_FILE}" && echo "✅ compose uses SIDDES_BACKEND_PORT"
grep -q "choose_free_port" "${START_SCRIPT}" && echo "✅ starter auto-selects ports"
grep -q "NEXT_PUBLIC_API_BASE" "${START_SCRIPT}" && echo "✅ starter sets NEXT_PUBLIC_API_BASE"
