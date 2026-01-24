#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug panel side summary =="

FILE="frontend/src/components/InboxStubDebugPanel.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "Side summary" "$FILE"   && grep -q "counts.public" "$FILE"   && grep -q "counts.friends" "$FILE"   && grep -q "counts.close" "$FILE"   && grep -q "counts.work" "$FILE"; then
  echo "✅ Side summary counts present"
else
  echo "❌ Missing side summary counts"
  exit 1
fi
