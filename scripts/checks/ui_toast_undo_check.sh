#!/usr/bin/env bash
set -euo pipefail

echo "== Check: UI toast system + Undo (no alert()) =="

REQ=(
  "frontend/src/lib/toast.ts"
  "frontend/src/components/ToastHost.tsx"
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

AP="frontend/src/components/AppProviders.tsx"
if grep -q "ToastHost" "$AP"; then
  echo "✅ AppProviders wires ToastHost"
else
  echo "❌ AppProviders missing ToastHost wiring"
  exit 1
fi

OQ="frontend/src/lib/offlineQueue.ts"
if grep -q "removeQueuedItem" "$OQ"; then
  echo "✅ offlineQueue exports removeQueuedItem"
else
  echo "❌ offlineQueue missing removeQueuedItem"
  exit 1
fi

FILES=(
  "frontend/src/app/siddes-compose/page.tsx"
  "frontend/src/app/siddes-post/[id]/page.tsx"
  "frontend/src/components/PostCard.tsx"
  "frontend/src/components/NotificationsView.tsx"
  "frontend/src/components/SideFeed.tsx"
)

for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    if grep -q "alert(" "$f"; then
      echo "❌ $f still contains alert()"
      exit 1
    else
      echo "✅ no alert(): $f"
    fi
  fi
done

echo "✅ UI toast + undo OK"
