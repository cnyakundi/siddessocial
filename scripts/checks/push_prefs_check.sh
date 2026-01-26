#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push preferences (sd_743) =="

req=(
  backend/siddes_push/prefs.py
  backend/siddes_push/migrations/0002_pushpreferences.py
  frontend/src/app/api/push/prefs/route.ts
  frontend/src/components/PushPreferencesCard.tsx
)

for f in "${req[@]}"; do
  [[ -f "$f" ]] || { echo "❌ Missing: $f"; exit 1; }
done

grep -q "sd_743_push_prefs_ui" frontend/src/components/PushPreferencesCard.tsx || { echo "❌ Missing UI tag"; exit 1; }
grep -q "sd_743_push_prefs_gate" backend/siddes_notifications/service.py || { echo "❌ notify() does not gate pushes with prefs"; exit 1; }

echo "✅ push prefs check passed"
