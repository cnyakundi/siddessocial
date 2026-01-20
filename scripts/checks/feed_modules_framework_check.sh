#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Feed modules framework (sd_152c) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }

req "frontend/src/lib/flags.ts"
req "frontend/src/lib/feedModules.ts"
req "frontend/src/components/feedModules/FeedModuleCard.tsx"
req "frontend/src/components/SideFeed.tsx"

grep -q "NEXT_PUBLIC_SD_FEED_MODULES" frontend/src/lib/flags.ts || { echo "❌ flags missing NEXT_PUBLIC_SD_FEED_MODULES"; exit 1; }
grep -q "feedModules" frontend/src/lib/flags.ts || { echo "❌ flags missing feedModules"; exit 1; }

grep -q "planFeedModules" frontend/src/components/SideFeed.tsx || { echo "❌ SideFeed not using planFeedModules"; exit 1; }
grep -q "FeedModuleCard" frontend/src/components/SideFeed.tsx || { echo "❌ SideFeed not rendering FeedModuleCard"; exit 1; }
grep -q "FLAGS.feedModules" frontend/src/components/SideFeed.tsx || { echo "❌ SideFeed missing FLAGS.feedModules gating"; exit 1; }

echo "✅ Feed modules framework present"
