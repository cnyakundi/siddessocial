#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply offline queue =="

REQ=(
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

if grep -q "enqueueReply" "frontend/src/app/siddes-post/[id]/page.tsx"; then
  echo "✅ Post detail queues replies when offline"
else
  echo "❌ Post detail does not queue replies"
  exit 1
fi
