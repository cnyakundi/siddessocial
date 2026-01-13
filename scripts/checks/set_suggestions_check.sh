#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Set suggestions after sync =="

REQ=(
  "frontend/src/lib/setSuggestions.ts"
  "frontend/src/components/SuggestedSetsSheet.tsx"
  "frontend/src/components/ImportSetSheet.tsx"
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

if grep -q "SuggestedSetsSheet" "frontend/src/components/ImportSetSheet.tsx"; then
  echo "✅ ImportSetSheet references SuggestedSetsSheet"
else
  echo "❌ ImportSetSheet not wired to SuggestedSetsSheet"
  exit 1
fi
