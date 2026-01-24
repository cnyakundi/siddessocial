#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Prism graph safety (no legacy follow + no Public broadcasts mode) =="

fail=0

req() {
  local f="$1"
  if [[ ! -e "$f" ]]; then
    echo "❌ Missing: $f"
    fail=1
  fi
}

req "backend/siddes_prism/models.py"
req "backend/siddes_prism/views.py"
req "backend/siddes_prism/urls.py"
req "frontend/src/components/SideFeed.tsx"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

# ---- Follow edge must be removed from Prism (MVP rule)
if grep -q "class UserFollow" "backend/siddes_prism/models.py"; then
  echo "❌ Legacy public subscription model still present: backend/siddes_prism/models.py (class UserFollow)"
  fail=1
else
  echo "✅ No UserFollow model in siddes_prism"
fi

if grep -q "FollowActionView" "backend/siddes_prism/views.py"; then
  echo "❌ Legacy action view still present: FollowActionView"
  fail=1
else
  echo "✅ No FollowActionView in siddes_prism"
fi

if grep -q 'path("follow"' "backend/siddes_prism/urls.py"; then
  echo "❌ Legacy /api/follow route still present in siddes_prism/urls.py"
  fail=1
else
  echo "✅ No /api/follow route in siddes_prism"
fi

if grep -q '"viewerFollows"' "backend/siddes_prism/views.py" || grep -q '"followers"' "backend/siddes_prism/views.py"; then
  echo "❌ Legacy follower fields still present in ProfileView response"
  fail=1
else
  echo "✅ No follower fields in ProfileView response"
fi

# ---- Frontend must not reference /api/follow
if grep -R --line-number --fixed-strings '"/api/follow"' "frontend/src" >/dev/null 2>&1; then
  echo "❌ Frontend still references /api/follow"
  grep -R --line-number --fixed-strings '"/api/follow"' "frontend/src" | head -n 10 || true
  fail=1
else
  echo "✅ Frontend does not reference /api/follow"
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
  echo "  - Apply the overlays that remove follow + broadcasts surfaces (Prism + Public UI)."
  exit 1
fi

echo "✅ Prism graph safety guard passed"
