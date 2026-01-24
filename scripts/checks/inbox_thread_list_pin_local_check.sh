#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list pin (local) =="

REQ=(
  "frontend/src/lib/inboxPins.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
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

# localStorage key + toggler
if grep -q 'sd.inbox.pins.v0' "frontend/src/lib/inboxPins.ts"   && grep -q "togglePinned" "frontend/src/lib/inboxPins.ts"; then
  echo "✅ Pin storage + toggler present"
else
  echo "❌ Pin storage missing"
  exit 1
fi

# UI + pinned-first sort
if grep -q 'aria-label={t.pinned ? "Unpin thread" : "Pin thread"}' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "a.pinned !== b.pinned" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Pin UI + pinned-first sort present"
else
  echo "❌ Pin UI or pinned-first sort missing"
  exit 1
fi
