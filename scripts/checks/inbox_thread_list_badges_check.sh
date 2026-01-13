#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list badges =="

REQ=(
  "frontend/src/lib/mockInbox.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
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

if grep -q "lockedSide" "frontend/src/lib/mockInbox.ts"; then
  echo "✅ mockInbox has lockedSide"
else
  echo "❌ mockInbox missing lockedSide"
  exit 1
fi

if grep -q "SidePill" "frontend/src/app/siddes-inbox/page.tsx" && grep -q "ensureThreadLockedSide" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Locked Side badge wiring present"
else
  echo "❌ Locked Side badge wiring missing"
  exit 1
fi

if grep -q "Unread" "frontend/src/app/siddes-inbox/page.tsx" && grep -q "t.unread" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Unread hint present"
else
  echo "❌ Unread hint missing"
  exit 1
fi
