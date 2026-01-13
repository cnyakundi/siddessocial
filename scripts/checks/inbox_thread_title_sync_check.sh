#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread title sync (backend_stub) =="

REQ=(
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
  "docs/INBOX_THREAD_TITLE_SYNC.md"
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

if grep -q "deriveThreadTitle" "frontend/src/app/api/inbox/threads/route.ts"   && grep -q "deriveThreadTitle" "frontend/src/app/api/inbox/thread/[id]/route.ts"   && grep -q "isGenericTitle" "frontend/src/app/api/inbox/threads/route.ts"; then
  echo "✅ Title sync helpers present + used"
else
  echo "❌ Missing title sync helpers/usage"
  exit 1
fi
