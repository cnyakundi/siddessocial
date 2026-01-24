#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox server unread counters =="

REQ=(
  "frontend/src/lib/server/inboxStore.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
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

STORE="frontend/src/lib/server/inboxStore.ts"
THREADS="frontend/src/app/api/inbox/threads/route.ts"
THREAD="frontend/src/app/api/inbox/thread/[id]/route.ts"

if grep -q "getThreadUnread" "$STORE"   && grep -q "clearThreadUnreadRole" "$STORE"   && grep -q "viewerRole" "$STORE"; then
  echo "✅ Store exposes unread counter APIs"
else
  echo "❌ Missing unread counter APIs in store"
  exit 1
fi

if grep -q "getThreadUnread" "$THREADS" && grep -q "unread" "$THREADS"; then
  echo "✅ Threads endpoint uses server unread counters"
else
  echo "❌ Threads endpoint not using unread counters"
  exit 1
fi

if grep -q "clearThreadUnreadRole" "$THREAD" && grep -q "viewerRole" "$THREAD"; then
  echo "✅ Thread endpoint clears/increments unread"
else
  echo "❌ Thread endpoint not clearing/incrementing unread"
  exit 1
fi
