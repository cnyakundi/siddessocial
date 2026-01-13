#!/usr/bin/env bash
set -euo pipefail

echo "== Check: smoke scripts auto-load ops/docker/.env (sd_147a) =="

REQ=(
  "ops/docker/.env.example"
  "scripts/dev/_autoload_docker_env.sh"
  "scripts/dev/posts_drf_smoke.sh"
  "scripts/dev/posts_db_persistence_smoke.sh"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done
[[ "$missing" -ne 0 ]] && exit 1

grep -q "ops/docker/.env" scripts/dev/_autoload_docker_env.sh && echo "✅ autoload reads ops/docker/.env" || (echo "❌ autoload missing .env" && exit 1)
grep -q "ops/docker/.env.example" scripts/dev/_autoload_docker_env.sh && echo "✅ autoload reads .env.example" || (echo "❌ autoload missing .env.example" && exit 1)

grep -q "SIDDES_BACKEND_PORT" scripts/dev/posts_drf_smoke.sh && echo "✅ posts_drf_smoke uses SIDDES_BACKEND_PORT" || (echo "❌ posts_drf_smoke missing SIDDES_BACKEND_PORT" && exit 1)
grep -q "_autoload_docker_env.sh" scripts/dev/posts_drf_smoke.sh && echo "✅ posts_drf_smoke uses autoload" || (echo "❌ posts_drf_smoke missing autoload" && exit 1)

echo "✅ smoke env autoload check passed"
