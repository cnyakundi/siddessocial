#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Replies API store + queue events =="

REQ=(
  "frontend/src/lib/server/repliesStore.ts"
  "frontend/src/app/api/post/[id]/replies/route.ts"
  "frontend/src/app/api/post/[id]/reply/route.ts"
  "frontend/src/lib/offlineQueue.ts"
  "frontend/src/components/QueueIndicator.tsx"
  "frontend/src/app/siddes-post/[id]/page.tsx"
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

if grep -q "/replies" "frontend/src/app/siddes-post/[id]/page.tsx"; then
  echo "✅ Post detail references replies endpoint"
else
  echo "❌ Post detail missing replies endpoint reference"
  exit 1
fi
