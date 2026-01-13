#!/usr/bin/env bash
set -euo pipefail

echo "== Check: TopNav wired =="

REQ=(
  "frontend/src/components/TopNav.tsx"
  "frontend/src/components/AppProviders.tsx"
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

if grep -q "TopNav" "frontend/src/components/AppProviders.tsx"; then
  echo "✅ AppProviders wires TopNav"
else
  echo "❌ AppProviders does not wire TopNav"
  exit 1
fi
