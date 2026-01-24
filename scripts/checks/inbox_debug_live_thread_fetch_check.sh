#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug panel live thread fetch =="

FILE="frontend/src/components/InboxStubDebugPanel.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "/api/inbox/threads" "$FILE"   && grep -q "setThreadOptions" "$FILE"   && grep -q "threadsLoading" "$FILE"; then
  echo "✅ Live thread list fetch wiring present"
else
  echo "❌ Live thread list fetch wiring missing"
  exit 1
fi
