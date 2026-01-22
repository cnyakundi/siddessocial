#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Feed provider abstraction =="

REQ=(
  "frontend/src/lib/feedProvider.ts"
  "frontend/src/lib/feedProviders/backendStub.ts"
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/components/SideFeed.tsx"
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

if grep -q "getFeedProvider" "frontend/src/components/SideFeed.tsx"; then
  echo "✅ SideFeed uses feed provider"
else
  echo "❌ SideFeed does not use feed provider"
  exit 1
fi
