#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply composer stub =="

REQ=(
  "frontend/src/components/ReplyComposer.tsx"
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

if grep -q "ReplyComposer" "frontend/src/app/siddes-post/[id]/page.tsx"; then
  echo "✅ Post detail wires ReplyComposer"
else
  echo "❌ Post detail not wired to ReplyComposer"
  exit 1
fi
