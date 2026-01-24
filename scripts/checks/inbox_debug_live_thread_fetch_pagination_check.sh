#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug panel live fetch pagination =="

FILE="frontend/src/components/InboxStubDebugPanel.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "/api/inbox/threads" "$FILE"   && grep -q "nextCursor" "$FILE"   && grep -q "hasMore" "$FILE"   && grep -q "cursor" "$FILE"; then
  echo "✅ Debug panel pagination logic present"
else
  echo "❌ Missing debug panel pagination logic"
  exit 1
fi
