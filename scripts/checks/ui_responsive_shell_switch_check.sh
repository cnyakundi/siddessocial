#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Responsive Shell Switch (sd_152f) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }

req "frontend/src/components/AppShell.tsx"
req "frontend/src/components/DesktopSideRail.tsx"
req "frontend/src/components/DesktopTopBar.tsx"
req "frontend/src/components/AppProviders.tsx"

grep -q "AppShell" frontend/src/components/AppProviders.tsx || { echo "❌ AppProviders not using AppShell"; exit 1; }
grep -q "md:hidden" frontend/src/components/AppShell.tsx || { echo "❌ AppShell missing md:hidden breakpoint usage"; exit 1; }
grep -q "hidden md:flex" frontend/src/components/DesktopSideRail.tsx || { echo "❌ DesktopSideRail not desktop-only"; exit 1; }
grep -q "hidden md:block" frontend/src/components/DesktopTopBar.tsx || { echo "❌ DesktopTopBar not desktop-only"; exit 1; }

echo "✅ Responsive shell switch present"
