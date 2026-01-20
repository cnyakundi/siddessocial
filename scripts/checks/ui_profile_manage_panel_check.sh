#!/usr/bin/env bash
set -euo pipefail

echo "== Check: UI Profile Manage Panel + Settings route (sd_151b) =="

REQ=(
  "docs/UI_LAUNCH_MVP.md"
  "frontend/src/components/AppTopBar.tsx"
  "frontend/src/components/BottomNav.tsx"
  "frontend/src/components/FirstRunSidePicker.tsx"
  "frontend/src/app/siddes-settings/page.tsx"
  "frontend/src/components/AppShell.tsx"
  "frontend/src/components/AppProviders.tsx"
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
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

PV="frontend/src/components/ProfileView.tsx"
grep -q 'data-testid="profile-manage-panel"' "$PV" || { echo "❌ ProfileView missing manage panel (data-testid=profile-manage-panel)"; exit 1; }
echo "✅ ProfileView contains manage panel"

for href in "/siddes-sets" "/siddes-invites" "/siddes-settings"; do
  grep -q "href=\"$href\"" "$PV" || { echo "❌ Manage panel missing link to $href"; exit 1; }
  echo "✅ Manage panel links to $href"
done

# Architecture: AppProviders wires AppShell. AppShell renders AppTopBar + BottomNav.
AP="frontend/src/components/AppProviders.tsx"
AS="frontend/src/components/AppShell.tsx"

grep -q "<AppShell" "$AP" || { echo "❌ AppProviders missing <AppShell"; exit 1; }
grep -q "<FirstRunSidePicker" "$AP" || { echo "❌ AppProviders missing <FirstRunSidePicker"; exit 1; }
echo "✅ AppProviders wires AppShell + FirstRunSidePicker"

grep -q "<AppTopBar" "$AS" || { echo "❌ AppShell missing <AppTopBar"; exit 1; }
grep -q "<BottomNav" "$AS" || { echo "❌ AppShell missing <BottomNav"; exit 1; }
echo "✅ AppShell renders AppTopBar + BottomNav"

echo "✅ UI profile manage panel OK"
