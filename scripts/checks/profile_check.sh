#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Profile side strip + access gate =="

REQ=(
  "frontend/src/lib/mockUsers.ts"
  "frontend/src/components/ProfileView.tsx"
  "frontend/src/app/siddes-profile/page.tsx"
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

if grep -q "access" "frontend/src/lib/mockUsers.ts" && grep -q "Private Content" "frontend/src/components/ProfileView.tsx"; then
  echo "✅ Access gate present"
else
  echo "❌ Access gate not detected"
  exit 1
fi
