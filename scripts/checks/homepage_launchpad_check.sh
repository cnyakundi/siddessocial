#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "== Check: Homepage launchpad / Home=Feed (sd_150c) =="

HOME="frontend/src/app/page.tsx"
[[ -f "$HOME" ]] || { echo "❌ Missing $HOME"; exit 1; }

# New world: / redirects to feed, launchpad lives at /launchpad
if grep -q 'redirect("/siddes-feed")' "$HOME"; then
  echo "✅ Home redirects to /siddes-feed"
  LP="frontend/src/app/launchpad/page.tsx"
  [[ -f "$LP" ]] || { echo "❌ Missing launchpad page: $LP"; exit 1; }
  grep -q "Siddes Launchpad" "$LP" || { echo "❌ Launchpad page missing title"; exit 1; }
  echo "✅ Launchpad exists at /launchpad"
  exit 0
fi

# Legacy world: homepage itself is the launchpad
if grep -q "App areas" "$HOME"; then
  echo "✅ Legacy homepage launchpad detected"
  exit 0
fi

echo "❌ Homepage is neither redirect(/siddes-feed) nor legacy launchpad"
exit 1
