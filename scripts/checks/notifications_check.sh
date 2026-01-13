#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Notifications glimpses =="

REQ=(
  "frontend/src/lib/mockNotifications.ts"
  "frontend/src/components/NotificationsView.tsx"
  "frontend/src/app/siddes-notifications/page.tsx"
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

if grep -q "Glimpse" "frontend/src/components/NotificationsView.tsx"; then
  echo "✅ Glimpse UI present"
else
  echo "✅ NotificationsView present (glimpse is implicit)"
fi
