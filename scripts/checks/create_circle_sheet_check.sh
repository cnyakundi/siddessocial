#!/usr/bin/env bash
set -euo pipefail

echo "== Check: CreateCircleSheet guided flow (Circles naming) =="

REQ=(
  "frontend/src/components/CreateCircleSheet.tsx"
  "frontend/src/app/siddes-circles/page.tsx"
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

grep -q "CreateCircleSheet" frontend/src/app/siddes-circles/page.tsx && echo "✅ Circles page references CreateCircleSheet" || (echo "❌ Circles page missing CreateCircleSheet" && exit 1)
grep -q "Guided flow" frontend/src/app/siddes-circles/page.tsx && echo "✅ Guided flow CTA present" || (echo "❌ Guided flow CTA missing" && exit 1)

echo "✅ create circle sheet check passed"
