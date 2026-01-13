#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread page context risk strip =="

REQ=("frontend/src/app/siddes-inbox/[id]/page.tsx")

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

# Ensure Context: substring still present (mentions gate depends on it)
if grep -q "Context:" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Context: substring present"
else
  echo "❌ Missing required substring: Context:"
  exit 1
fi

# Context Risk strip present + private condition
if grep -q "ContextRiskStrip" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Context Risk" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "isPrivate" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Context risk strip present + conditional"
else
  echo "❌ Context risk strip missing or not conditional"
  exit 1
fi
