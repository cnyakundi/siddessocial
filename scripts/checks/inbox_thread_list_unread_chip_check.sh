#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list unread chip =="

REQ=("frontend/src/app/siddes-inbox/page.tsx")

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

if grep -q 'label="Unread"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'filter === "unread"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'counts.unread' "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Unread chip present + wired"
else
  echo "❌ Unread chip missing or not wired"
  exit 1
fi
