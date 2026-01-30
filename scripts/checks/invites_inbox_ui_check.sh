#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Invites inbox UI + suggestions prefill =="

REQ=(
  "frontend/src/app/siddes-invites/page.tsx"
  "frontend/src/components/TopNav.tsx"
  "frontend/src/components/Invites/InviteActionSheet.tsx"
  "frontend/src/app/siddes-circles/[id]/page.tsx"
  "docs/STATE.md"
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

grep -q "/siddes-invites" frontend/src/components/TopNav.tsx && echo "✅ TopNav includes /siddes-invites" || (echo "❌ TopNav missing /siddes-invites" && exit 1)

grep -q "getInviteProvider" frontend/src/app/siddes-invites/page.tsx && echo "✅ Invites page uses provider" || (echo "❌ Invites page missing getInviteProvider" && exit 1)
grep -q "invites\\.act" frontend/src/app/siddes-invites/page.tsx && echo "✅ Invites page supports actions" || (echo "❌ Invites page missing invites.act" && exit 1)

grep -Fq "prefillTo?: string" frontend/src/components/Invites/InviteActionSheet.tsx && echo "✅ InviteActionSheet supports prefillTo" || (echo "❌ InviteActionSheet missing prefillTo prop" && exit 1)
grep -q "prefillTo={prefillTo" "frontend/src/app/siddes-circles/[id]/page.tsx" && echo "✅ Circle detail passes prefillTo" || (echo "❌ Circle detail missing prefillTo wiring" && exit 1)

grep -q "sd_138c" docs/STATE.md && echo "✅ STATE doc mentions sd_138c" || (echo "❌ docs/STATE.md missing sd_138c" && exit 1)
