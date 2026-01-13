#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox pages wrap useSearchParams in Suspense =="

LIST="frontend/src/app/siddes-inbox/page.tsx"
THREAD="frontend/src/app/siddes-inbox/[id]/page.tsx"

if [[ ! -f "$LIST" ]]; then
  echo "❌ Missing: $LIST"
  exit 1
fi
if [[ ! -f "$THREAD" ]]; then
  echo "❌ Missing: $THREAD"
  exit 1
fi

if grep -q "useSearchParams" "$LIST" && grep -q "Suspense" "$LIST"; then
  echo "✅ Inbox list uses useSearchParams inside Suspense wrapper"
else
  echo "❌ Inbox list missing Suspense wrapper"
  exit 1
fi

if grep -q "useSearchParams" "$THREAD" && grep -q "Suspense" "$THREAD"; then
  echo "✅ Thread page uses useSearchParams inside Suspense wrapper"
else
  echo "❌ Thread page missing Suspense wrapper"
  exit 1
fi
