#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Signals counter + sheet =="

REQ=(
  "frontend/src/components/SignalsSheet.tsx"
  "frontend/src/components/PostCard.tsx"
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

if grep -q "SignalsSheet" "frontend/src/components/PostCard.tsx"; then
  echo "✅ PostCard references SignalsSheet"
else
  echo "❌ PostCard not wired to SignalsSheet"
  exit 1
fi
