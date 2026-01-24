#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Backend Python syntax (compileall) =="

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

if [[ ! -d backend ]]; then
  echo "SKIP: no backend/ directory"
  exit 0
fi

# Prefer host python (fast). If missing, fall back to Docker (works on clean Macs).
PY="${PYTHON:-python3}"
if command -v "${PY}" >/dev/null 2>&1; then
  "${PY}" -m compileall -q backend
  echo "✅ backend compileall passed (host python)"
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  python3 -m compileall -q backend
  echo "✅ backend compileall passed (host python3)"
  exit 0
fi

if command -v python >/dev/null 2>&1; then
  python -m compileall -q backend
  echo "✅ backend compileall passed (host python)"
  exit 0
fi

# Docker fallback
if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: python not found and docker not available; cannot run compileall."
  echo "      Install python3 or Docker Desktop to enable this guardrail."
  exit 0
fi

COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
fi

if [[ "${#COMPOSE[@]}" -eq 0 ]]; then
  echo "WARN: Docker Compose not available; cannot run compileall in container."
  exit 0
fi

if [[ ! -f ops/docker/docker-compose.dev.yml ]]; then
  echo "WARN: ops/docker/docker-compose.dev.yml missing; cannot run compileall in container."
  exit 0
fi

# Ensure env exists so docker compose doesn't error on missing env file.
if [[ ! -f ops/docker/.env && -f ops/docker/.env.example ]]; then
  cp ops/docker/.env.example ops/docker/.env || true
fi

# Backend container WORKDIR is /app/backend, so compile current dir.
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python -m compileall -q .

echo "✅ backend compileall passed (docker)"
