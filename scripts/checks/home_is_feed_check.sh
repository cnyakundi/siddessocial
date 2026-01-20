#!/usr/bin/env bash
set -euo pipefail
echo "== Check: Home redirects to Feed (sd_150b) =="

F="frontend/src/app/page.tsx"
[[ -f "$F" ]] || { echo "❌ Missing $F"; exit 1; }

grep -q 'redirect("/siddes-feed")' "$F" || { echo "❌ Home does not redirect to /siddes-feed"; exit 1; }
[[ -f "frontend/src/app/launchpad/page.tsx" ]] || { echo "❌ Missing /launchpad page"; exit 1; }

echo "✅ Home=Feed and /launchpad exists"
