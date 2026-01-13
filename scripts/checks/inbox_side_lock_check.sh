#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox Side lock =="

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

if grep -q "Locked:" "frontend/src/app/siddes-inbox/[id]/page.tsx" && grep -q "Move thread to this Side" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Side lock UI present"
else
  echo "❌ Side lock UI missing"
  exit 1
fi
