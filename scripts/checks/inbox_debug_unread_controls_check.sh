#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug unread controls =="

REQ=(
  "frontend/src/components/InboxStubDebugPanel.tsx"
  "frontend/src/app/api/inbox/debug/unread/reset/route.ts"
  "frontend/src/app/api/inbox/debug/incoming/route.ts"
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

if grep -q "Clear local unread" "frontend/src/components/InboxStubDebugPanel.tsx"   && grep -q "Clear server unread" "frontend/src/components/InboxStubDebugPanel.tsx"   && grep -q "Simulate incoming" "frontend/src/components/InboxStubDebugPanel.tsx"; then
  echo "✅ Debug panel controls present"
else
  echo "❌ Missing debug panel controls"
  exit 1
fi
