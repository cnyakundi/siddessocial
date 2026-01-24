#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list search bar =="

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

# Search UI present
if grep -q 'placeholder="Search threads"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "setQuery" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "Clear search" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Search bar UI present"
else
  echo "❌ Search bar UI missing"
  exit 1
fi

# Search filtering logic present
if grep -q "title.includes(q)" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "last.includes(q)" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Search filtering logic present"
else
  echo "❌ Search filtering logic missing"
  exit 1
fi
