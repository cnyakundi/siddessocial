#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread move confirm on privacy downgrade =="

REQ=("frontend/src/app/siddes-inbox/[id]/page.tsx")

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

# Confirm UI + downgrade condition
if grep -q "Confirm move" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "isPrivacyDowngrade" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "moveConfirmTo" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Move anyway" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Move confirm present + wired"
else
  echo "❌ Move confirm missing or not wired"
  exit 1
fi

# Ensure existing gates won't break
if grep -q "Move thread to this Side" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Locked:" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "Context:" "frontend/src/app/siddes-inbox/[id]/page.tsx"   && grep -q "clearThreadUnread" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Required legacy substrings preserved"
else
  echo "❌ Missing required legacy substrings (would break existing gates)"
  exit 1
fi
