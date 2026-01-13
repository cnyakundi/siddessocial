#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread move Side picker sheet =="

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

PAGE="frontend/src/app/siddes-inbox/[id]/page.tsx"

# Core wiring
if ! (grep -q "SidePickerSheet" "$PAGE" && grep -q "movePickerOpen" "$PAGE" && grep -q "requestMoveTo" "$PAGE"); then
  echo "❌ Side picker sheet missing or not wired"
  exit 1
fi

# Prefer stable marker
if grep -q 'data-testid="move-sheet"' "$PAGE"; then
  echo "✅ Side picker sheet present + wired (testid)"
  exit 0
fi

# Legacy fallback substring
if grep -q "Pick a Side" "$PAGE"; then
  echo "✅ Side picker sheet present + wired (legacy)"
else
  echo "❌ Side picker sheet missing or not wired"
  exit 1
fi
