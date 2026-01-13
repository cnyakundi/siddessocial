#!/usr/bin/env bash
set -euo pipefail

echo "== Check: LastSeen-driven activity =="

REQ=(
  "frontend/src/lib/lastSeen.ts"
  "frontend/src/lib/sideActivity.ts"
  "frontend/src/components/SideFeed.tsx"
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

if grep -q "New since last visit" "frontend/src/components/SideFeed.tsx"; then
  echo "✅ Divider text present"
else
  echo "❌ Divider not found in SideFeed"
  exit 1
fi
