#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push API stubs present =="

REQ=(
  "frontend/src/app/api/push/vapid/route.ts"
  "frontend/src/app/api/push/subscribe/route.ts"
  "frontend/src/app/api/push/unsubscribe/route.ts"
  "frontend/src/components/PushSettings.tsx"
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

if grep -q "/api/push/vapid" "frontend/src/components/PushSettings.tsx"; then
  echo "✅ PushSettings calls /api/push/vapid"
else
  echo "❌ PushSettings not wired to /api/push/vapid"
  exit 1
fi
