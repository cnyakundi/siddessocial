#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circle suggestions after sync =="

REQ=(
  "frontend/src/lib/circleSuggestions.ts"
  "frontend/src/components/SuggestedCirclesSheet.tsx"
  "frontend/src/components/ImportCircleSheet.tsx"
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

if grep -q "SuggestedCirclesSheet" "frontend/src/components/ImportCircleSheet.tsx"; then
  echo "✅ ImportCircleSheet references SuggestedCirclesSheet"
else
  echo "❌ ImportCircleSheet not wired to SuggestedCirclesSheet"
  exit 1
fi
