#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox threads pagination =="

REQ=(
  "frontend/src/app/api/inbox/threads/route.ts"
  "docs/INBOX_PAGINATION.md"
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

if grep -q "parseCursor" "$PAGE"   && grep -q "nextCursor" "$PAGE"   && grep -q "hasMore" "$PAGE"   && grep -q "limit" "$PAGE"   && grep -q "cursor" "$PAGE"; then
  echo "✅ Pagination fields present"
else
  echo "❌ Pagination logic missing"
  exit 1
fi
