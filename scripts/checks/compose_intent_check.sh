#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Compose intent refinements =="

REQ=(
  "frontend/src/lib/composeIntent.ts"
  "frontend/src/components/ComposeSuggestionBar.tsx"
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

if grep -q "Why:" "frontend/src/components/ComposeSuggestionBar.tsx"; then
  echo "✅ Why tooltips present"
else
  echo "❌ Why tooltips not detected"
  exit 1
fi
