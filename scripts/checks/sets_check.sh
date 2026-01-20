#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets UI wiring (chips row OR filter bar) =="

REQ=(
  "frontend/src/lib/sets.ts"
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

have_chips=0
have_filter=0

if [[ -f "frontend/src/components/SetsChipsRow.tsx" ]]; then
  echo "✅ frontend/src/components/SetsChipsRow.tsx"
  have_chips=1
else
  echo "• Optional missing: frontend/src/components/SetsChipsRow.tsx"
fi

if [[ -f "frontend/src/components/SetFilterBar.tsx" ]]; then
  echo "✅ frontend/src/components/SetFilterBar.tsx"
  have_filter=1
  if [[ -f "frontend/src/components/SetPickerSheet.tsx" ]]; then
    echo "✅ frontend/src/components/SetPickerSheet.tsx"
  else
    echo "❌ Missing: frontend/src/components/SetPickerSheet.tsx (required by SetFilterBar)"
    exit 1
  fi
else
  echo "• Optional missing: frontend/src/components/SetFilterBar.tsx"
fi

if [[ "$have_chips" -eq 0 && "$have_filter" -eq 0 ]]; then
  echo "❌ Missing both SetsChipsRow and SetFilterBar implementations"
  exit 1
fi

SF="frontend/src/components/SideFeed.tsx"
if grep -q "SetFilterBar" "$SF"; then
  echo "✅ SideFeed references SetFilterBar"
elif grep -q "SetsChipsRow" "$SF"; then
  echo "✅ SideFeed references SetsChipsRow"
else
  echo "❌ SideFeed not wired to SetFilterBar or SetsChipsRow"
  exit 1
fi

echo "✅ Sets UI check OK"
