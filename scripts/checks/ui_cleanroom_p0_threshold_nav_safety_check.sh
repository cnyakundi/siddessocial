#!/usr/bin/env bash
set -euo pipefail

echo "== Check: UI Cleanroom P0 (Threshold + Nav + Chameleon + Tap targets) =="

fail() { echo "❌ $*"; exit 1; }
ok() { echo "✅ $*"; }

require_file() {
  local f="$1"
  [[ -f "$f" ]] || fail "Missing required file: $f"
  ok "$f"
}

require_grep() {
  local pat="$1"
  local f="$2"
  local msg="$3"
  grep -q "$pat" "$f" || fail "$msg (pattern not found: $pat)"
  ok "$msg"
}

# --- Required files ---
SIDE_PROVIDER="frontend/src/components/SideProvider.tsx"
POST_CARD="frontend/src/components/PostCard.tsx"
BOTTOM_NAV="frontend/src/components/BottomNav.tsx"
DESKTOP_RAIL="frontend/src/components/DesktopSideRail.tsx"
FTR_PICKER="frontend/src/components/FirstRunSidePicker.tsx"

require_file "$SIDE_PROVIDER"
require_file "$POST_CARD"
require_file "$BOTTOM_NAV"
require_file "$DESKTOP_RAIL"
require_file "$FTR_PICKER"

echo ""

# --- Threshold: entering Public requires confirm everywhere (central gateway) ---
require_grep "PublicEnterConfirmSheet" "$SIDE_PROVIDER" "SideProvider wires PublicEnterConfirmSheet"
require_grep "open={confirmPublic}" "$SIDE_PROVIDER" "SideProvider renders confirm sheet"
require_grep "if (next === \"public\" && side !== \"public\")" "$SIDE_PROVIDER" "SideProvider gates Public entry in setSide()"

echo ""

# --- PostCard: tap targets + chameleon compliance ---
require_grep "const ACTION_BASE" "$POST_CARD" "PostCard defines ACTION_BASE (44x44)"

# Like button uses ACTION_BASE
ln_like="$(grep -n "onClick={toggleLike}" "$POST_CARD" | head -n1 | cut -d: -f1 || true)"
[[ -n "$ln_like" ]] || fail "PostCard: could not locate toggleLike button"
start=$((ln_like-15)); [[ $start -lt 1 ]] && start=1
end=$((ln_like+6))
if sed -n "${start},${end}p" "$POST_CARD" | grep -q "ACTION_BASE"; then
  ok "PostCard Like uses ACTION_BASE (prevents mis-taps)"
else
  fail "PostCard Like does not appear to use ACTION_BASE near toggleLike"
fi

# Echo uses Side theme (Public must be blue, not emerald)
if grep -q "echoed ? theme.text" "$POST_CARD"; then
  ok "PostCard Echo uses theme.text (side-correct color)"
else
  fail "PostCard Echo must use theme.text when echoed"
fi

# Avatar palette must NOT use Side colors (blue/emerald/rose/slate families)
av_block="$(awk '
  /const AVATAR_STYLES = \[/{flag=1}
  flag{print}
  /\] as const;/{flag=0}
' "$POST_CARD")"

if [[ -z "$av_block" ]]; then
  fail "PostCard: could not extract AVATAR_STYLES block"
fi

if echo "$av_block" | grep -Eiq "(emerald-|rose-|sky-|blue-|slate-)"; then
  echo "---- AVATAR_STYLES block ----"
  echo "$av_block"
  echo "----------------------------"
  fail "Avatar palette contains Side colors (violates Chameleon law)"
else
  ok "Avatar palette avoids Side colors"
fi

echo ""

# --- Navigation: Sets is primary on mobile; Public active is side-based ---
require_grep "href=\"/siddes-sets\"" "$BOTTOM_NAV" "BottomNav includes Sets"
require_grep "Icon={Layers}" "$BOTTOM_NAV" "BottomNav Sets uses Layers icon (no Users collision)"
require_grep "publicActive = side === \"public\"" "$BOTTOM_NAV" "BottomNav Public active state is side-based"

# Desktop sets icon collision check
require_grep "{ href: \"/siddes-sets\", label: \"Sets\", icon: Layers }" "$DESKTOP_RAIL" "DesktopSideRail Sets uses Layers icon"

# First-run picker must not appear on onboarding/auth/about routes
require_grep "pathname.startsWith(\"/onboarding\")" "$FTR_PICKER" "FirstRunSidePicker hidden during onboarding"
require_grep "pathname.startsWith(\"/login\")" "$FTR_PICKER" "FirstRunSidePicker hidden during login"
require_grep "pathname.startsWith(\"/signup\")" "$FTR_PICKER" "FirstRunSidePicker hidden during signup"

echo ""
echo "✅ UI Cleanroom P0 checks passed."
echo ""
echo "Manual QA (5 min):"
echo "  1) Tap Public in BottomNav (while in Friends): confirm appears once; Cancel stays in Friends."
echo "  2) Visit /siddes-broadcasts while not in Public: confirm appears once; Cancel returns safely."
echo "  3) PostCard: Like is easy to hit; Echo uses Public-blue; avatars are non-Side colors."
