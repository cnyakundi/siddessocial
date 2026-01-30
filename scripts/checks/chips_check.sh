#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Context chips + overflow sheet =="

REQ=(
  "frontend/src/lib/chips.ts"
  "frontend/src/lib/circleThemes.ts"
  "frontend/src/components/ChipOverflowSheet.tsx"
  "frontend/src/components/PostCard.tsx"
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

if grep -q "ChipOverflowSheet" "frontend/src/components/PostCard.tsx"; then
  echo "✅ PostCard uses ChipOverflowSheet"
else
  echo "❌ PostCard not wired to ChipOverflowSheet"
  exit 1
fi
