#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread composer =="

REQ=(
  "frontend/src/lib/threadStore.ts"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
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

if grep -q "Message" "frontend/src/app/siddes-inbox/[id]/page.tsx" && grep -q "Send" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Composer UI present"
else
  echo "❌ Composer UI missing"
  exit 1
fi
