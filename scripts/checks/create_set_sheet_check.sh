#!/usr/bin/env bash
set -euo pipefail

echo "== Check: CreateSetSheet guided flow (Circles naming) =="

REQ=(
  "frontend/src/components/CreateSetSheet.tsx"
  "frontend/src/app/siddes-sets/page.tsx"
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
[[ "$missing" -ne 0 ]] && exit 1

grep -q "CreateSetSheet" frontend/src/app/siddes-sets/page.tsx && echo "✅ Circles page references CreateSetSheet" || (echo "❌ Circles page missing CreateSetSheet" && exit 1)
grep -q "Guided flow" frontend/src/app/siddes-sets/page.tsx && echo "✅ Guided flow CTA present" || (echo "❌ Guided flow CTA missing" && exit 1)

echo "✅ create circle sheet check passed"
