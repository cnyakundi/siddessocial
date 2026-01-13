#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox error state banners =="

REQ=(
  "frontend/src/components/InboxBanner.tsx"
  "frontend/src/app/siddes-inbox/page.tsx"
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

if grep -q "Restricted inbox" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "Inbox error" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "Restricted thread" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Thread error" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Inbox/thread error banners present"
else
  echo "❌ Missing error banners"
  exit 1
fi
