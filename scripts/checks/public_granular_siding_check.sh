#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Granular Siding (sd_129) =="

REQ=(
  "frontend/src/lib/publicSiding.ts"
  "frontend/src/components/PublicChannelPrefsSheet.tsx"
  "frontend/src/components/ProfileView.tsx"
  "frontend/src/components/SideFeed.tsx"
  "docs/PUBLIC_CHANNELS.md"
  "docs/STATE.md"
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

need() {
  local file="$1"
  local pat="$2"
  if grep -qE "$pat" "$file"; then
    echo "✅ $file matches: $pat"
  else
    echo "❌ $file missing pattern: $pat"
    exit 1
  fi
}

need "frontend/src/lib/publicSiding.ts" "sd\.publicSiding\.v0"
need "frontend/src/lib/publicSiding.ts" "EVT_PUBLIC_SIDING_CHANGED"
need "frontend/src/components/PublicChannelPrefsSheet.tsx" "setPublicSidingChannels"
need "frontend/src/components/ProfileView.tsx" "PublicChannelPrefsSheet"
need "frontend/src/components/ProfileView.tsx" "togglePublicSiding"
need "frontend/src/components/SideFeed.tsx" "loadPublicSiding"
need "frontend/src/components/SideFeed.tsx" "EVT_PUBLIC_SIDING_CHANGED"
need "docs/STATE.md" "sd_129"
need "docs/PUBLIC_CHANNELS.md" "sd_129"

echo "✅ Public Granular Siding check passed"
