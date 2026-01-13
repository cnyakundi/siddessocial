#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets membership UX polish (sd_140a) =="

req_file () {
  local p="$1"
  if [[ -f "$p" ]]; then
    echo "✅ $p"
  else
    echo "❌ Missing: $p"
    exit 1
  fi
}

req_grep () {
  local p="$1"
  local pat="$2"
  if grep -E -q "$pat" "$p"; then
    echo "✅ $p contains: $pat"
  else
    echo "❌ $p missing: $pat"
    exit 1
  fi
}

req_file "frontend/src/components/SetsJoinedBanner.tsx"
req_file "frontend/src/app/siddes-sets/page.tsx"
req_file "frontend/src/app/siddes-sets/[id]/page.tsx"
req_file "frontend/src/components/Invites/InviteActionSheet.tsx"
req_file "docs/STATE.md"

echo ""
req_grep "frontend/src/app/siddes-sets/[id]/page.tsx" "SetsJoinedBanner"
req_grep "frontend/src/app/siddes-sets/[id]/page.tsx" "Members \(\{membersCount\}\)"
req_grep "frontend/src/app/siddes-sets/page.tsx" "SetsJoinedPill"
req_grep "frontend/src/components/Invites/InviteActionSheet.tsx" "Invite more to this Set"
req_grep "docs/STATE.md" "sd_140a"

echo ""
echo "✅ sd_140a UX polish check passed"
