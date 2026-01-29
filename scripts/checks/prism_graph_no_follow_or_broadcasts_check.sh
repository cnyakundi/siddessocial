#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Prism graph safety (no Public broadcasts mode) =="

fail=0

req() {
  local f="$1"
  if [[ ! -e "$f" ]]; then
    echo "❌ Missing: $f"
    fail=1
  fi
}

req "frontend/src/components/SideFeed.tsx"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

# ---- Public broadcasts mode must not exist in SideFeed
if grep -q 'publicMode' "frontend/src/components/SideFeed.tsx"; then
  echo "❌ SideFeed still contains publicMode toggle (Following/Broadcasts). MVP rule: remove it."
  fail=1
else
  echo "✅ SideFeed has no publicMode toggle"
fi

if grep -R --line-number --fixed-strings "/api/broadcasts" "frontend/src" >/dev/null 2>&1; then
  echo "❌ Frontend still references /api/broadcasts"
  grep -R --line-number --fixed-strings "/api/broadcasts" "frontend/src" | head -n 10 || true
  fail=1
else
  echo "✅ Frontend does not reference /api/broadcasts"
fi

if [[ -d "frontend/src/app/api/broadcasts" ]]; then
  echo "❌ Next API proxy routes for broadcasts still exist: frontend/src/app/api/broadcasts"
  fail=1
else
  echo "✅ No Next API broadcasts proxy routes"
fi

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Fix:"
  echo "  - Remove Public broadcasts surfaces (Prism + Public UI)."
  exit 1
fi

echo "✅ Prism graph safety guard passed"
