#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Deep links + post detail =="

REQ=(
  "frontend/src/lib/postLookup.ts"
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
