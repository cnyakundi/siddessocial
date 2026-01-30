#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Import set flow wired =="

REQ=(
  "frontend/src/components/ImportCircleSheet.tsx"
  "frontend/src/lib/sets.ts"
  "frontend/src/components/CirclesChipsRow.tsx"
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

if grep -q "ImportCircleSheet" "frontend/src/components/SideFeed.tsx"; then
  echo "✅ SideFeed wires ImportCircleSheet"
else
  echo "❌ SideFeed not wired to ImportCircleSheet"
  exit 1
fi
