#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Legal pages (Terms / Privacy / Account deletion) =="

REQ=(
  "frontend/src/app/terms/page.tsx"
  "frontend/src/app/privacy/page.tsx"
  "frontend/src/app/legal/terms/page.tsx"
  "frontend/src/app/legal/privacy/page.tsx"
  "frontend/src/app/legal/account-deletion/page.tsx"
  "frontend/src/app/confirm-delete/page.tsx"
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

echo "✅ legal pages present"
