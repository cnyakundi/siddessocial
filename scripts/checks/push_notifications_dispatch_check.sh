#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push auto-dispatch on notifications (sd_742) =="

req=(
  backend/siddes_push/send.py
  backend/siddes_notifications/service.py
)

for f in "${req[@]}"; do
  [[ -f "$f" ]] || { echo "❌ Missing: $f"; exit 1; }
done

grep -q "sd_742_push_auto_dispatch" backend/siddes_push/send.py || { echo "❌ send.py missing sd_742 tag"; exit 1; }
grep -q "sd_742_push_auto_dispatch_on_notifications" backend/siddes_notifications/service.py || { echo "❌ notifications service missing sd_742 tag"; exit 1; }

echo "✅ push auto-dispatch check passed"
