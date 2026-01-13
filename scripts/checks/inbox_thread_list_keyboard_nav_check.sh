#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list keyboard nav =="

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

# Key handler present
if grep -q 'addEventListener("keydown"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'key === "j"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'key === "k"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'router.push' "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Keyboard nav wiring present"
else
  echo "❌ Keyboard nav wiring missing"
  exit 1
fi

# Listbox roles
if grep -q 'role="listbox"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'role="option"' "frontend/src/app/siddes-inbox/page.tsx"   && grep -q 'aria-selected' "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Accessible listbox/option roles present"
else
  echo "❌ Accessibility roles missing"
  exit 1
fi
