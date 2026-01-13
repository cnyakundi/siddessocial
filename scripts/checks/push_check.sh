#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push notifications scaffolding =="

REQ=(
  "docs/PUSH_NOTIFICATIONS.md"
  "frontend/src/components/PushSettings.tsx"
  "frontend/src/app/siddes-push/page.tsx"
  "frontend/public/sw.js"
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

# Accept both single and double quotes.
if grep -Eq "addEventListener\(['\"]push['\"]" "frontend/public/sw.js" && grep -q "notificationclick" "frontend/public/sw.js"; then
  echo "✅ SW push handlers present"
else
  echo "❌ SW push handlers missing"
  exit 1
fi
