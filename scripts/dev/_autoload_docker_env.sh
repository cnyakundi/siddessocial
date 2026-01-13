#!/usr/bin/env bash
set -euo pipefail

# Auto-load docker env so SIDDES_* ports are available.
# Source order:
# 1) ops/docker/.env (local overrides)
# 2) ops/docker/.env.example (safe defaults)

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [[ -f "ops/docker/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ops/docker/.env || true
  set +a
elif [[ -f "ops/docker/.env.example" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ops/docker/.env.example || true
  set +a
fi
