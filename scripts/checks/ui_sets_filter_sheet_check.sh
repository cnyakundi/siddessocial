#!/usr/bin/env bash
set -euo pipefail

echo "== Check: UI Circles-as-filter (CircleFilterBar + CirclePickerSheet) =="

REQ=(
  "frontend/src/components/CircleFilterBar.tsx"
  "frontend/src/components/CirclePickerSheet.tsx"
  "docs/UI_LAUNCH_MVP.md"
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

SF="frontend/src/components/SideFeed.tsx"
if grep -q "CircleFilterBar" "$SF"; then
  echo "✅ SideFeed uses CircleFilterBar"
else
  echo "❌ SideFeed missing CircleFilterBar"
  exit 1
fi

CP="frontend/src/app/siddes-compose/page.tsx"
if grep -q "compose-set-picker" "$CP"; then
  echo "✅ Compose has manual set picker (compose-set-picker)"
else
  echo "❌ Compose missing manual set picker (compose-set-picker)"
  exit 1
fi

SP="frontend/src/app/siddes-circles/page.tsx"
if grep -q 'sp.get("create") === "1"' "$SP"; then
  echo "✅ Circles page supports ?create=1 deep-link"
else
  echo "❌ Circles page missing ?create=1 deep-link support"
  exit 1
fi

DOC="docs/UI_LAUNCH_MVP.md"
if grep -q "Circles-as-filter (Step 2)" "$DOC"; then
  echo "✅ UI_LAUNCH_MVP docs include Circles-as-filter section"
else
  echo "❌ UI_LAUNCH_MVP docs missing Circles-as-filter section"
  exit 1
fi

echo "✅ UI Circles-as-filter OK"
