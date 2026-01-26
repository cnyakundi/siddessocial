#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push backend wiring (sd_741_push_backend_db) =="

req=(
  backend/siddes_push/apps.py
  backend/siddes_push/models.py
  backend/siddes_push/views.py
  backend/siddes_push/urls.py
  backend/siddes_push/migrations/0001_initial.py
  frontend/src/app/api/push/status/route.ts
  frontend/src/app/api/push/subscribe/route.ts
  frontend/src/app/api/push/unsubscribe/route.ts
  frontend/src/app/api/push/debug/send/route.ts
  frontend/src/components/PushNotificationsCard.tsx
)

for f in "${req[@]}"; do
  [[ -f "$f" ]] || { echo "❌ Missing: $f"; exit 1; }
done

grep -q "siddes_push.apps.SiddesPushConfig" backend/siddes_backend/settings.py || { echo "❌ settings.py does not include siddes_push"; exit 1; }
grep -q 'path("push/", include("siddes_push.urls"))' backend/siddes_backend/api.py || { echo "❌ api.py does not route /api/push/"; exit 1; }

grep -q "/api/push/subscribe" frontend/src/components/PushNotificationsCard.tsx || { echo "❌ PushNotificationsCard does not call /api/push/subscribe"; exit 1; }

echo "✅ push backend wiring check passed"
