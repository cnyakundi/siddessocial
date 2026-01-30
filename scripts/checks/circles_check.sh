#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles UI wiring (chips row OR filter bar) =="

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

if [[ -f "frontend/src/components/CirclesChipsRow.tsx" ]]; then
  echo "✅ frontend/src/components/CirclesChipsRow.tsx"
  have_chips=1
else
  echo "• Optional missing: frontend/src/components/CirclesChipsRow.tsx"
fi

if [[ -f "frontend/src/components/CircleFilterBar.tsx" ]]; then
  echo "✅ frontend/src/components/CircleFilterBar.tsx"
  have_filter=1
  if [[ -f "frontend/src/components/CirclePickerSheet.tsx" ]]; then
    echo "✅ frontend/src/components/CirclePickerSheet.tsx"
  else
    echo "❌ Missing: frontend/src/components/CirclePickerSheet.tsx (required by CircleFilterBar)"
    exit 1
  fi
else
  echo "• Optional missing: frontend/src/components/CircleFilterBar.tsx"
fi

if [[ "$have_chips" -eq 0 && "$have_filter" -eq 0 ]]; then
  echo "❌ Missing both CirclesChipsRow and CircleFilterBar implementations"
  exit 1
fi

SF="frontend/src/components/SideFeed.tsx"
if grep -q "CircleFilterBar" "$SF"; then
  echo "✅ SideFeed references CircleFilterBar"
elif grep -q "CirclesChipsRow" "$SF"; then
  echo "✅ SideFeed references CirclesChipsRow"
else
  echo "❌ SideFeed not wired to CircleFilterBar or CirclesChipsRow"
  exit 1
fi

echo "✅ Circles UI check OK"
