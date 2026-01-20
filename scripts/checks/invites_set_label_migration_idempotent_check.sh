#!/usr/bin/env bash
set -euo pipefail

echo "== Check: invites set_label migration is idempotent (sd_160d) =="

F="backend/siddes_invites/migrations/0002_invite_set_label.py"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"

grep -q "ADD COLUMN IF NOT EXISTS set_label" "$F" || { echo "❌ 0002 migration missing IF NOT EXISTS"; exit 1; }

echo "✅ idempotent migration OK"
