#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Navigation shell wired (AppShell + AppTopBar + BottomNav) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing $1"; exit 1; }; }

req "frontend/src/components/AppProviders.tsx"
req "frontend/src/components/AppTopBar.tsx"
req "frontend/src/components/BottomNav.tsx"

# Prefer new architecture: AppProviders -> AppShell -> (AppTopBar + BottomNav)
if [[ -f "frontend/src/components/AppShell.tsx" ]]; then
  req "frontend/src/components/AppShell.tsx"

  if ! grep -q "AppShell" "frontend/src/components/AppProviders.tsx"; then
    echo "❌ AppProviders does not wire AppShell"
    exit 1
  fi

  grep -q "AppTopBar" "frontend/src/components/AppShell.tsx" || { echo "❌ AppShell does not render AppTopBar"; exit 1; }
  grep -q "BottomNav" "frontend/src/components/AppShell.tsx" || { echo "❌ AppShell does not render BottomNav"; exit 1; }

  echo "✅ AppProviders wires AppShell"
  echo "✅ AppShell renders AppTopBar + BottomNav"
  exit 0
fi

# Legacy fallback: AppProviders directly renders AppTopBar + BottomNav
grep -q "AppTopBar" "frontend/src/components/AppProviders.tsx" || { echo "❌ AppProviders does not wire AppTopBar (legacy)"; exit 1; }
grep -q "BottomNav" "frontend/src/components/AppProviders.tsx" || { echo "❌ AppProviders does not wire BottomNav (legacy)"; exit 1; }

echo "✅ AppProviders wires AppTopBar + BottomNav (legacy)"
