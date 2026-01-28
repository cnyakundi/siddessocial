#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Feed modules removed (sd_777) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }

req "frontend/src/lib/flags.ts"
req "frontend/src/components/SideFeed.tsx"

if grep -q "NEXT_PUBLIC_SD_FEED_MODULES" frontend/src/lib/flags.ts; then
  echo "❌ flags.ts still references NEXT_PUBLIC_SD_FEED_MODULES"; exit 1;
fi
if grep -q "\bfeedModules\b" frontend/src/lib/flags.ts; then
  echo "❌ flags.ts still defines feedModules"; exit 1;
fi

if [[ -f "frontend/src/lib/feedModules.ts" ]]; then
  echo "❌ feedModules.ts still exists"; exit 1;
fi
if [[ -f "frontend/src/components/feedModules/FeedModuleCard.tsx" ]]; then
  echo "❌ FeedModuleCard.tsx still exists"; exit 1;
fi

for pat in planFeedModules EVT_FEED_MODULES_CHANGED FeedModuleCard FLAGS.feedModules modulePlan modulesAfter; do
  if grep -q "$pat" frontend/src/components/SideFeed.tsx; then
    echo "❌ SideFeed still contains: $pat"; exit 1;
  fi
done

echo "✅ Feed modules framework removed (posts-only MVP feed)"
