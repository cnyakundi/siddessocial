#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Safety basics (block / mute / report endpoints wired) =="

U="backend/siddes_safety/urls.py"
API="backend/siddes_backend/api.py"
V="backend/siddes_safety/views.py"

[[ -f "$U" ]] || { echo "❌ Missing: $U"; exit 1; }
[[ -f "$API" ]] || { echo "❌ Missing: $API"; exit 1; }
[[ -f "$V" ]] || { echo "❌ Missing: $V"; exit 1; }

grep -q 'path("blocks"' "$U" || { echo "❌ Missing blocks route in $U"; exit 1; }
grep -q 'path("mutes"' "$U" || { echo "❌ Missing mutes route in $U"; exit 1; }
grep -q 'path("reports"' "$U" || { echo "❌ Missing reports route in $U"; exit 1; }

grep -q 'include("siddes_safety.urls")' "$API" || { echo "❌ siddes_safety.urls not included in $API"; exit 1; }

echo "✅ safety endpoints wired"
