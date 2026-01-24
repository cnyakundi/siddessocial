#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox unread state =="

REQ=(
  "frontend/src/lib/inboxState.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
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

if grep -q "loadThreadUnread" "frontend/src/lib/inboxState.ts" && grep -q "clearThreadUnread" "frontend/src/lib/inboxState.ts"; then
  echo "✅ inboxState exports present"
else
  echo "❌ inboxState exports missing"
  exit 1
fi

if grep -q "loadUnreadMap" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Inbox list reads unread state"
else
  echo "❌ Inbox list not reading unread state"
  exit 1
fi

if grep -q "clearThreadUnread" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Thread auto-marks read on open"
else
  echo "❌ Thread not marking read"
  exit 1
fi
