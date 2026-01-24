#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread messages pagination =="

REQ=(
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
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

API="frontend/src/app/api/inbox/thread/[id]/route.ts"

if grep -q "messagesHasMore" "$API" && grep -q "messagesNextCursor" "$API" && grep -q "parseCursor" "$API"; then
  echo "✅ API exposes messagesHasMore/messagesNextCursor"
else
  echo "❌ API pagination fields missing"
  exit 1
fi

UI="frontend/src/app/siddes-inbox/[id]/page.tsx"
if grep -q "Load earlier" "$UI" && grep -q "thread-load-earlier" "$UI" && grep -q "cursor: msgCursor" "$UI"; then
  echo "✅ UI load-earlier wiring present"
else
  echo "❌ UI load-earlier wiring missing"
  exit 1
fi
