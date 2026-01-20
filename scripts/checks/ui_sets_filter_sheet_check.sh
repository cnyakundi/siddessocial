#!/usr/bin/env bash
set -euo pipefail

echo "== Check: UI Sets-as-filter (SetFilterBar + SetPickerSheet) =="

REQ=(
  "frontend/src/components/SetFilterBar.tsx"
  "frontend/src/components/SetPickerSheet.tsx"
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
if grep -q "SetFilterBar" "$SF"; then
  echo "✅ SideFeed uses SetFilterBar"
else
  echo "❌ SideFeed missing SetFilterBar"
  exit 1
fi

CP="frontend/src/app/siddes-compose/page.tsx"
if grep -q "compose-set-picker" "$CP"; then
  echo "✅ Compose has manual set picker (compose-set-picker)"
else
  echo "❌ Compose missing manual set picker (compose-set-picker)"
  exit 1
fi

SP="frontend/src/app/siddes-sets/page.tsx"
if grep -q 'sp.get("create") === "1"' "$SP"; then
  echo "✅ Sets page supports ?create=1 deep-link"
else
  echo "❌ Sets page missing ?create=1 deep-link support"
  exit 1
fi

DOC="docs/UI_LAUNCH_MVP.md"
if grep -q "Sets-as-filter (Step 2)" "$DOC"; then
  echo "✅ UI_LAUNCH_MVP docs include Sets-as-filter section"
else
  echo "❌ UI_LAUNCH_MVP docs missing Sets-as-filter section"
  exit 1
fi

echo "✅ UI Sets-as-filter OK"
