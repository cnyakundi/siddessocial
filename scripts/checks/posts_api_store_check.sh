#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts API store + feed merge =="

REQ=(
  "frontend/src/lib/server/postsStore.ts"
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
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

if grep -q "postsStore" "frontend/src/app/api/post/route.ts" && grep -q "listPostsBySide" "frontend/src/app/api/feed/route.ts"; then
  echo "✅ API routes wired to postsStore"
else
  echo "❌ API routes not wired to postsStore"
  exit 1
fi
