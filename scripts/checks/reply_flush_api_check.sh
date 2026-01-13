#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply flush calls API stubs =="

REQ=(
  "frontend/src/app/api/post/[id]/reply/route.ts"
  "frontend/src/app/api/post/route.ts"
  "frontend/src/lib/offlineQueue.ts"
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

if grep -q "/api/post/" "frontend/src/lib/offlineQueue.ts" && grep -q "/reply" "frontend/src/lib/offlineQueue.ts"; then
  echo "✅ offlineQueue flush references /api/post and /reply"
else
  echo "❌ offlineQueue flush does not reference expected API paths"
  exit 1
fi
