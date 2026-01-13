#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts DRF smoke script (sd_144c) =="

REQ=(
  "scripts/dev/posts_drf_smoke.sh"
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

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

grep -q "/api/post" scripts/dev/posts_drf_smoke.sh && echo "✅ smoke script hits /api/post" || (echo "❌ smoke script missing /api/post" && exit 1)
grep -q "x-sd-viewer" scripts/dev/posts_drf_smoke.sh && echo "✅ smoke script uses x-sd-viewer" || (echo "❌ smoke script missing x-sd-viewer" && exit 1)

echo "✅ posts drf smoke script check passed"
