#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Notifications DB-backed =="

REQ=(
  "frontend/src/app/api/notifications/route.ts"
  "frontend/src/app/api/notifications/mark-all-read/route.ts"
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

if grep -q "/api/notifications" "frontend/src/components/NotificationsView.tsx"; then
  echo "✅ NotificationsView fetches /api/notifications"
else
  echo "❌ NotificationsView does not fetch /api/notifications"
  exit 1
fi

if grep -q "MOCK_NOTIFICATIONS" "frontend/src/components/NotificationsView.tsx"; then
  echo "❌ MOCK_NOTIFICATIONS still referenced"
  exit 1
else
  echo "✅ No MOCK_NOTIFICATIONS references"
fi

if grep -qi "cache-control" "frontend/src/app/api/notifications/route.ts" && grep -qi "no-store" "frontend/src/app/api/notifications/route.ts"; then
  echo "✅ /api/notifications sets cache-control: no-store"
else
  echo "❌ /api/notifications missing cache-control: no-store"
  exit 1
fi

if grep -qi "cache-control" "frontend/src/app/api/notifications/mark-all-read/route.ts" && grep -qi "no-store" "frontend/src/app/api/notifications/mark-all-read/route.ts"; then
  echo "✅ /api/notifications/mark-all-read sets cache-control: no-store"
else
  echo "❌ /api/notifications/mark-all-read missing cache-control: no-store"
  exit 1
fi
