#!/usr/bin/env bash
set -euo pipefail

# UI Blunders Sweep (Siddes MVP Skeleton)
# This is a high-signal guardrail: it checks for the big "it feels like a platform again" regressions.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail() {
  echo "❌ UI blunders sweep failed: $1"
  exit 1
}

ok() {
  echo "✅ $1"
}

# -------------------------
# 1) Shell: no stacked headers (mobile) and no extra rails (desktop)
# -------------------------
AS="$ROOT/frontend/src/components/AppShell.tsx"
if [ ! -f "$AS" ]; then
  fail "Missing AppShell.tsx"
fi

if grep -RIn 'MobileSideTabsRow' "$AS" >/dev/null 2>&1; then
  fail "MobileSideTabsRow is still referenced in AppShell (stacked chrome regression)."
fi

if grep -RIn 'DesktopWorkspaceNav' "$AS" >/dev/null 2>&1; then
  fail "DesktopWorkspaceNav is still referenced in AppShell (extra rail regression)."
fi

if grep -RIn 'DesktopContextInspectorRail' "$AS" >/dev/null 2>&1; then
  fail "DesktopContextInspectorRail is still referenced in AppShell (right rail regression)."
fi

ok "Shell: single header on mobile + single lane on desktop"

# -------------------------
# 2) Bottom nav naming: Now (not Home) + 5 destinations only
# -------------------------
BN="$ROOT/frontend/src/components/BottomNav.tsx"
if [ ! -f "$BN" ]; then
  fail "Missing BottomNav.tsx"
fi

if ! grep -RIn 'Now' "$BN" >/dev/null 2>&1; then
  fail "BottomNav does not contain the label Now (expected Now/Circles/Create/Inbox/Me)."
fi

# Avoid false positives: only fail if actual UI text says Home
if grep -RIn -E '>\s*Home\s*<|aria-label="Home"|title="Home"' "$BN" >/dev/null 2>&1; then
  fail "BottomNav still exposes Home label. It must be Now."
fi

ok "BottomNav: Now naming present"

# -------------------------
# 3) Feed: must render row variant posts
# -------------------------
SF="$ROOT/frontend/src/components/SideFeed.tsx"
if [ ! -f "$SF" ]; then
  fail "Missing SideFeed.tsx"
fi
if ! grep -RIn 'variant="row"' "$SF" >/dev/null 2>&1; then
  fail "SideFeed is not passing variant=\"row\" to PostCard (feed must be flat rows)."
fi
ok "Feed: row variant enforced"

# -------------------------
# 4) PostCard: row variant support exists
# -------------------------
PC="$ROOT/frontend/src/components/PostCard.tsx"
if [ ! -f "$PC" ]; then
  fail "Missing PostCard.tsx"
fi

if ! grep -RIn -E 'variant\?\:\s*"card"\s*\|\s*"row"|variant\?\:\s*"row"\s*\|\s*"card"' "$PC" >/dev/null 2>&1; then
  fail "PostCard does not declare variant?: \"card\" | \"row\"."
fi

if ! grep -RIn 'const isRow = variant === "row"' "$PC" >/dev/null 2>&1; then
  fail "PostCard does not define isRow = variant === \"row\"."
fi

ok "PostCard: supports row/card variants"

# -------------------------
# 5) Search: route exists and header entrypoints exist
# -------------------------
SP="$ROOT/frontend/src/app/siddes-search/page.tsx"
SC="$ROOT/frontend/src/app/siddes-search/client.tsx"
if [ ! -f "$SP" ] || [ ! -f "$SC" ]; then
  fail "Search route missing: expected /frontend/src/app/siddes-search/(page.tsx + client.tsx)."
fi

AT="$ROOT/frontend/src/components/AppTopBar.tsx"
DT="$ROOT/frontend/src/components/DesktopTopBar.tsx"
if [ -f "$AT" ] && ! grep -RIn 'href="/siddes-search"' "$AT" >/dev/null 2>&1; then
  fail "AppTopBar does not link to /siddes-search."
fi
if [ -f "$DT" ] && ! grep -RIn 'href="/siddes-search"' "$DT" >/dev/null 2>&1; then
  fail "DesktopTopBar does not link to /siddes-search."
fi

ok "Search: route + entrypoints present"

# -------------------------
# 6) Run existing checks if present
# -------------------------
if [ -f "$ROOT/scripts/checks/ui_guardrails_check.sh" ]; then
  "$ROOT/scripts/checks/ui_guardrails_check.sh"
fi

if [ -f "$ROOT/scripts/checks/search_privacy_guardrails_check.sh" ]; then
  "$ROOT/scripts/checks/search_privacy_guardrails_check.sh"
fi

ok "UI blunders sweep complete"
