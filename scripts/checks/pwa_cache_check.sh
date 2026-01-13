#!/usr/bin/env bash
set -euo pipefail

echo "== Check: PWA caching baseline =="

REQ=(
  "frontend/public/sw.js"
  "frontend/public/offline.html"
  "frontend/public/manifest.webmanifest"
  "frontend/src/components/PwaClient.tsx"
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

if grep -q "PwaClient" "frontend/src/components/AppProviders.tsx"; then
  echo "✅ AppProviders wires PwaClient"
else
  echo "❌ AppProviders does not wire PwaClient"
  exit 1
fi
