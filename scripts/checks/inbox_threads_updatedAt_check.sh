#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox threads updatedAt =="

REQ=(
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/components/InboxStubDebugPanel.tsx"
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

API="frontend/src/app/api/inbox/threads/route.ts"
if grep -q "updatedAt" "$API" && grep -q "unread," "$API"; then
  echo "✅ Threads API includes updatedAt per item"
else
  echo "❌ Threads API missing updatedAt"
  exit 1
fi

PANEL="frontend/src/components/InboxStubDebugPanel.tsx"
if grep -q "updatedAt" "$PANEL" && grep -q "sortTs" "$PANEL"; then
  echo "✅ Debug panel uses updatedAt when present"
else
  echo "❌ Debug panel not using updatedAt"
  exit 1
fi
