#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Notifications grouping =="

REQ=(
  "frontend/src/components/NotificationsView.tsx"
  "frontend/src/lib/mockNotifications.ts"
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

if grep -q "Today" "frontend/src/components/NotificationsView.tsx" && grep -q "Earlier" "frontend/src/components/NotificationsView.tsx"; then
  echo "✅ Today/Earlier sections present"
else
  echo "❌ Sections not found"
  exit 1
fi
