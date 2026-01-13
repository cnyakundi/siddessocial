#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Thread renders queued replies =="

REQ=(
  "frontend/src/lib/offlineQueue.ts"
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

if grep -q "Queued replies" "frontend/src/app/siddes-post/[id]/page.tsx"; then
  echo "✅ Queued replies section present"
else
  echo "❌ Queued replies section not found"
  exit 1
fi
