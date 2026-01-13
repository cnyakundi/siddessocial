#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets chips row + filtering =="

REQ=(
  "frontend/src/lib/sets.ts"
  "frontend/src/components/SetsChipsRow.tsx"
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

if grep -q "SetsChipsRow" "frontend/src/components/SideFeed.tsx"; then
  echo "✅ SideFeed references SetsChipsRow"
else
  echo "❌ SideFeed not wired to SetsChipsRow"
  exit 1
fi
