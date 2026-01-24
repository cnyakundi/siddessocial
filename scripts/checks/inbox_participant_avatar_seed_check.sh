#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox participant avatar seed =="

REQ=(
  "frontend/src/lib/server/inboxParticipant.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
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

if grep -q "participantForThread" "frontend/src/app/api/inbox/threads/route.ts"   && grep -q "participant" "frontend/src/app/api/inbox/threads/route.ts"   && grep -q "participantForThread" "frontend/src/app/api/inbox/thread/[id]/route.ts"; then
  echo "✅ API includes participant fields"
else
  echo "❌ API participant fields missing"
  exit 1
fi

if grep -q "AvatarBubble" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "AvatarBubble" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ UI avatar bubble present"
else
  echo "❌ UI avatar bubble missing"
  exit 1
fi
