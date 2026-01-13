#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Side Peek wired =="

REQ=(
  "frontend/src/components/PeekSheet.tsx"
  "frontend/src/components/SideBadge.tsx"
  "frontend/src/components/SideChrome.tsx"
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

if grep -q "onLongPress" "frontend/src/components/SideChrome.tsx" && grep -q "PeekSheet" "frontend/src/components/SideChrome.tsx"; then
  echo "✅ SideChrome wires onLongPress to PeekSheet"
else
  echo "❌ SideChrome not wired for Peek"
  exit 1
fi
