#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox move recents import =="

REQ=(
  "frontend/src/lib/inboxMoveRecents.ts"
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

if grep -q 'from "@/src/lib/inboxMoveRecents"' "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "loadRecentMoveSides" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "pushRecentMoveSide" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Recents imports + usage present"
else
  echo "❌ Missing recents import (would fail typecheck)"
  exit 1
fi
