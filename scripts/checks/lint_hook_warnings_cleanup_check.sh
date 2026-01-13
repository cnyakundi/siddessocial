#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Lint hook warnings cleanup =="

# inbox page no refreshTick dependency
if grep -q "refreshTick" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "❌ refreshTick still present in inbox list page"
  exit 1
else
  echo "✅ Inbox list refreshTick removed"
fi

POST="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$POST" ]]; then
  echo "❌ Missing: $POST"
  exit 1
fi

# post page: SentReplies refresh must be stable + included in deps
if grep -q "useCallback" "$POST"   && grep -q "const refresh = useCallback" "$POST"   && (grep -q "\[postId, refresh\]" "$POST" || grep -q "\[id, refresh\]" "$POST"); then
  echo "✅ Post detail refresh stabilized + deps fixed"
else
  echo "❌ Post detail hook fix missing"
  exit 1
fi
