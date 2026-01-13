#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Side switcher sheet present =="

REQ=(
  "frontend/src/components/SideSwitcherSheet.tsx"
  "frontend/src/lib/sideActivity.ts"
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

if grep -q "SideSwitcherSheet" "frontend/src/components/SideChrome.tsx"; then
  echo "✅ SideChrome imports SideSwitcherSheet"
else
  echo "❌ SideChrome does not reference SideSwitcherSheet"
  exit 1
fi
