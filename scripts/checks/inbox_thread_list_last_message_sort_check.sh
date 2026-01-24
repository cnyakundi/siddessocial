#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list last message + sort =="

REQ=(
  "frontend/src/app/siddes-inbox/page.tsx"
  "frontend/src/lib/threadStore.ts"
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

# Thread list reads last message + sorts
if grep -q "loadThread(" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "loadThreadMeta" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "sortTs" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q ".sort(" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Thread list reads threadStore + sorts"
else
  echo "❌ Thread list missing threadStore read/sort wiring"
  exit 1
fi

# appendMessage bumps updatedAt meta
if grep -q "appendMessage" "frontend/src/lib/threadStore.ts"   && grep -q "saveThreadMeta" "frontend/src/lib/threadStore.ts"   && grep -q "updatedAt" "frontend/src/lib/threadStore.ts"; then
  echo "✅ appendMessage updates meta.updatedAt"
else
  echo "❌ threadStore appendMessage does not update meta.updatedAt"
  exit 1
fi
