#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Feed scaffold + PostCard present =="

REQ=(
  "frontend/src/lib/mockFeed.ts"
  "frontend/src/components/PostCard.tsx"
  "frontend/src/components/SideFeed.tsx"
  "frontend/src/app/siddes-feed/page.tsx"
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
