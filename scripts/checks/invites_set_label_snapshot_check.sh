#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Invites setLabel snapshot (sd_141c) =="

REQ=(
  "frontend/src/lib/inviteProvider.ts"
  "frontend/src/lib/server/invitesStore.ts"
  "frontend/src/app/siddes-invites/page.tsx"
  "frontend/src/app/invite/[id]/page.tsx"
  "backend/siddes_invites/models.py"
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

# Type should include setLabel
grep -q "setLabel" frontend/src/lib/inviteProvider.ts && echo "✅ SetInvite has setLabel" || (echo "❌ SetInvite missing setLabel" && exit 1)

# Stub store should snapshot Circle label on create
grep -q "snapshot Circle label" frontend/src/lib/server/invitesStore.ts && echo "✅ invitesStore snapshots label" || (echo "❌ invitesStore missing snapshot comment/logic" && exit 1)
grep -q "getSet" frontend/src/lib/server/invitesStore.ts && echo "✅ invitesStore reads set via getSet" || (echo "❌ invitesStore missing getSet" && exit 1)

# UI should prefer invite.setLabel
grep -q "inv\.setLabel" frontend/src/app/siddes-invites/page.tsx && echo "✅ Invites list prefers inv.setLabel" || (echo "❌ Invites list missing inv.setLabel" && exit 1)
grep -q "item\.setLabel" frontend/src/app/invite/[id]/page.tsx && echo "✅ Invite detail uses item.circleLabel" || (echo "❌ Invite detail missing item.setLabel" && exit 1)

# Backend should persist set_label snapshot
grep -q "set_label" backend/siddes_invites/models.py && echo "✅ Django model has set_label" || (echo "❌ Django model missing set_label" && exit 1)

grep -q "sd_141c" docs/STATE.md && echo "✅ STATE doc mentions sd_141c" || (echo "❌ docs/STATE.md missing sd_141c" && exit 1)

echo "✅ Invites setLabel snapshot check passed"
