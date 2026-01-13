#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply routes stub visibility =="

REQ=(
  "frontend/src/app/api/post/[id]/reply/route.ts"
  "frontend/src/app/api/post/[id]/replies/route.ts"
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

if grep -q "sd_viewer" "frontend/src/app/api/post/[id]/reply/route.ts" && grep -q "sd_viewer" "frontend/src/app/api/post/[id]/replies/route.ts"; then
  echo "✅ Reply routes reference sd_viewer gate"
else
  echo "❌ Reply routes missing sd_viewer gate"
  exit 1
fi
