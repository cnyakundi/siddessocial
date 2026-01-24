#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug thread search + sort =="

FILE="frontend/src/components/InboxStubDebugPanel.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "Search threads" "$FILE"   && grep -q "threadSearch" "$FILE"   && grep -q "sortTs" "$FILE"   && grep -q "parseRelativeToTs" "$FILE"; then
  echo "✅ Debug picker search + recency sort present"
else
  echo "❌ Missing debug picker search/sort logic"
  exit 1
fi
