#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox server unread hints =="

REQ=(
  "frontend/src/app/api/inbox/threads/route.ts"
  "docs/INBOX_UNREAD_HINTS.md"
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

PAGE="frontend/src/app/api/inbox/threads/route.ts"

if grep -q "function unreadHint" "$PAGE"   && grep -q "unreadHint" "$PAGE"   && grep -q "unread," "$PAGE"   && grep -q "roleForViewer" "$PAGE"; then
  echo "✅ Server unread hint logic present"
else
  echo "❌ Missing server unread hint logic"
  exit 1
fi
