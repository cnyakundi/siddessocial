#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Unified Inbox (Messages + Alerts) + simplified BottomNav =="

REQ=(
  "frontend/src/components/BottomNav.tsx"
  "frontend/src/app/siddes-inbox/page.tsx"
  "frontend/src/components/NotificationsView.tsx"
  "frontend/src/app/siddes-notifications/page.tsx"
  "docs/UI_LAUNCH_MVP.md"
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

BN="frontend/src/components/BottomNav.tsx"
for p in "/siddes-feed" "/siddes-compose" "/siddes-inbox" "/siddes-profile"; do
  grep -q "$p" "$BN" || { echo "❌ BottomNav missing $p"; exit 1; }
  echo "✅ BottomNav includes $p"
done

if grep -q 'href: "/siddes-notifications"' "$BN" || grep -q 'href="/siddes-notifications"' "$BN" || grep -q "href='/siddes-notifications'" "$BN"; then
  echo "❌ BottomNav should not have a nav item for /siddes-notifications (Alerts live in Inbox)"
  exit 1
else
  echo "✅ BottomNav has no /siddes-notifications nav item"
fi

IP="frontend/src/app/siddes-inbox/page.tsx"
grep -q 'data-testid="inbox-tabs"' "$IP" || { echo "❌ Inbox tabs missing (data-testid=inbox-tabs)"; exit 1; }
grep -q 'inbox-tab-messages' "$IP" || { echo "❌ Inbox messages tab testid missing"; exit 1; }
grep -q 'inbox-tab-alerts' "$IP" || { echo "❌ Inbox alerts tab testid missing"; exit 1; }
grep -q "NotificationsView embedded" "$IP" || { echo "❌ Inbox Alerts does not embed NotificationsView"; exit 1; }

NP="frontend/src/app/siddes-notifications/page.tsx"
grep -q "/siddes-inbox?tab=alerts" "$NP" || { echo "❌ Notifications alias redirect missing"; exit 1; }

echo "✅ Unified Inbox check passed"
