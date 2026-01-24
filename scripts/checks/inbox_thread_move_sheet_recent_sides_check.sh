#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox move sheet recent sides + smart default =="

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

# localStorage key + helper usage
if grep -q "sd.inbox.move.recents.v0" "frontend/src/lib/inboxMoveRecents.ts"   && grep -q "pushRecentMoveSide" "frontend/src/lib/inboxMoveRecents.ts"   && grep -q "loadRecentMoveSides" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Recent sides storage + usage present"
else
  echo "❌ Recent sides storage/usage missing"
  exit 1
fi

# Suggested section + smart default
if grep -q "Suggested" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Move to {SIDES\[activeSide\]\.label}" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Suggested section + smart default button present"
else
  echo "❌ Suggested section/smart default missing"
  exit 1
fi

# Preserve legacy gates
if grep -q "Context:" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Locked:" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "clearThreadUnread" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Move thread to this Side" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Required legacy substrings preserved"
else
  echo "❌ Missing required legacy substrings"
  exit 1
fi
