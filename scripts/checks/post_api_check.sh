#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Post API stub + detail fetch option =="

REQ=(
  "frontend/src/app/api/post/[id]/route.ts"
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

if grep -q "/api/post/" "frontend/src/app/siddes-post/[id]/page.tsx"; then
  echo "✅ Post detail references /api/post/"
else
  echo "❌ Post detail does not reference /api/post/"
  exit 1
fi
