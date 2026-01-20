#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Auth bootstrap + shell exclusions (sd_161) =="

REQ=(
  "frontend/src/components/AuthBootstrap.tsx"
  "frontend/src/lib/authMe.ts"
  "frontend/src/components/AppProviders.tsx"
  "frontend/src/components/AppShell.tsx"
  "frontend/src/app/login/page.tsx"
  "frontend/src/app/signup/page.tsx"
  "frontend/src/app/onboarding/page.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done
[[ "$missing" -ne 0 ]] && exit 1

grep -q "fetchMe" frontend/src/components/AuthBootstrap.tsx || { echo "❌ AuthBootstrap missing fetchMe usage"; exit 1; }
grep -q "/api/auth/me" frontend/src/lib/authMe.ts || { echo "❌ authMe.ts missing /api/auth/me call"; exit 1; }
echo "✅ me fetch wired"

grep -q "AuthBootstrap" frontend/src/components/AppProviders.tsx || { echo "❌ AppProviders missing AuthBootstrap"; exit 1; }
echo "✅ AppProviders mounts AuthBootstrap"

grep -q "hideChrome" frontend/src/components/AppShell.tsx || { echo "❌ AppShell missing hideChrome logic"; exit 1; }
grep -q "usePathname" frontend/src/components/AppShell.tsx || { echo "❌ AppShell missing usePathname"; exit 1; }
echo "✅ AppShell excludes chrome on auth pages"

echo "✅ auth bootstrap check passed"
