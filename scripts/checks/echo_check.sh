#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Echo sheet wired =="

REQ=(
  "frontend/src/components/EchoSheet.tsx"
  "frontend/src/components/QuoteEchoComposer.tsx"
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

if grep -q "EchoSheet" "frontend/src/components/PostCard.tsx" && grep -q "QuoteEchoComposer" "frontend/src/components/PostCard.tsx"; then
  echo "✅ PostCard wires EchoSheet + QuoteEchoComposer"
else
  echo "❌ PostCard not wired to Echo components"
  exit 1
fi
