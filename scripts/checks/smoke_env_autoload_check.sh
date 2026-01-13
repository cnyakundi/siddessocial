#!/usr/bin/env bash
set -euo pipefail

echo "== Check: smoke scripts auto-load ops/docker/.env (sd_147a) =="

REQ=(
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

grep -q "ops/docker/.env" scripts/dev/posts_drf_smoke.sh && echo "✅ posts_drf_smoke loads ops/docker/.env" || (echo "❌ posts_drf_smoke missing env autoload" && exit 1)
grep -q "ops/docker/.env" scripts/dev/posts_db_persistence_smoke.sh && echo "✅ persistence smoke loads ops/docker/.env" || (echo "❌ persistence smoke missing env autoload" && exit 1)

grep -q "SIDDES_BACKEND_PORT" scripts/dev/posts_drf_smoke.sh && echo "✅ posts_drf_smoke uses SIDDES_BACKEND_PORT" || (echo "❌ posts_drf_smoke missing SIDDES_BACKEND_PORT usage" && exit 1)
grep -q "SIDDES_BACKEND_PORT" scripts/dev/posts_db_persistence_smoke.sh && echo "✅ persistence smoke uses SIDDES_BACKEND_PORT" || (echo "❌ persistence smoke missing SIDDES_BACKEND_PORT usage" && exit 1)

echo "✅ smoke env autoload check passed"
