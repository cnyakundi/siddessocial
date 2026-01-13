#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts+Replies Django /api wiring + Next proxy (sd_144a) =="

REQ=(
  "backend/siddes_backend/api.py"
  "backend/siddes_backend/urls.py"
  "backend/siddes_post/urls.py"
  "backend/siddes_post/views.py"
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
  "frontend/src/app/api/post/[id]/replies/route.ts"
  "frontend/src/app/api/post/[id]/reply/route.ts"
  "docs/STATE.md"
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

grep -q 'include("siddes_post.urls")' backend/siddes_backend/api.py && echo "✅ backend api includes siddes_post" || (echo "❌ backend/siddes_backend/api.py missing siddes_post include" && exit 1)

if grep -q 'include("siddes_post.urls")' backend/siddes_backend/urls.py; then
  echo "❌ backend/urls.py still mounts siddes_post at root (should live under /api)"
  exit 1
fi
echo "✅ backend/urls.py does not mount siddes_post at root"

for f in frontend/src/app/api/post/route.ts frontend/src/app/api/post/[id]/route.ts frontend/src/app/api/post/[id]/replies/route.ts frontend/src/app/api/post/[id]/reply/route.ts; do
  grep -q "NEXT_PUBLIC_API_BASE" "$f" && echo "✅ $f reads NEXT_PUBLIC_API_BASE" || (echo "❌ $f missing NEXT_PUBLIC_API_BASE proxy" && exit 1)
done

echo "✅ posts/replies django proxy check passed"
