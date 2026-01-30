#!/usr/bin/env bash
set -euo pipefail

# UI Guardrails (Siddes MVP Skeleton)
# Fail fast if "platform DNA" returns in primary UI.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail() {
  echo "❌ UI guardrails failed: $1"
  exit 1
}

cd "$ROOT"

# 1) No inline repost/echo in PostCard action bar (Echo must live under … only).
if grep -RIn --include='PostCard.tsx' -E 'Echo|Repost|Retweet' frontend/src/components/PostCard.tsx | grep -E '<button|<Button|aria-label=' >/dev/null 2>&1; then
  fail "PostCard contains inline Echo/Repost UI. Keep Echo under … (PostActionsSheet) only."
fi

# 2) No engagement counts in feed rows (hideCounts must default true; no likes/comments counts rendered in row variant).
# We allow counts in post detail pages, but SideFeed must pass variant=\"row\" and calmHideCounts not false.
if ! grep -RIn --include='SideFeed.tsx' -E 'variant="row"' frontend/src/components/SideFeed.tsx >/dev/null 2>&1; then
  fail "SideFeed is not passing variant=\"row\" to PostCard."
fi

# 3) No /Broadcasts/Settings entrypoints in navigation surfaces.
NAV_FILES=(
  "frontend/src/components/BottomNav.tsx"
  "frontend/src/components/DesktopSideDock.tsx"
  "frontend/src/components/DesktopTopBar.tsx"
  "frontend/src/components/AppTopBar.tsx"
)

for f in "${NAV_FILES[@]}"; do
  if [ -f "$ROOT/$f" ]; then
    if grep -In -E '/siddes-settings|/siddes-broadcasts|Explore Broadcasts' "$ROOT/$f" >/dev/null 2>&1; then
      fail "Found banned entrypoint (settings/broadcasts) in $f"
    fi
  fi
done

# 4) Side/Circle language: avoid Mode/Scope in visible labels.
if grep -RIn --include='*.tsx' -E '>Mode<|>Scope<' frontend/src/components/DesktopTopBar.tsx >/dev/null 2>&1; then
  fail "DesktopTopBar still shows Mode/Scope. Use Side/Circle."
fi

echo "✅ UI guardrails: OK"
