#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts DB persistence smoke script (sd_146c) =="

REQ=(
  "scripts/dev/posts_db_persistence_smoke.sh"
  "docs/DRF_SMOKE.md"
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

grep -q "docker compose" scripts/dev/posts_db_persistence_smoke.sh && echo "✅ uses docker compose" || (echo "❌ missing docker compose usage" && exit 1)
grep -q "restart" scripts/dev/posts_db_persistence_smoke.sh && echo "✅ restarts backend" || (echo "❌ missing restart logic" && exit 1)

grep -q "posts_db_persistence_smoke.sh" docs/DRF_SMOKE.md && echo "✅ docs mention persistence smoke" || (echo "❌ docs missing persistence smoke mention" && exit 1)

echo "✅ posts db persistence smoke check passed"
