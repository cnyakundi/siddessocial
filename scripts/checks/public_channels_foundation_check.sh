#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public channels foundation (sd_128) =="

REQ=(
  "frontend/src/lib/flags.ts"
  "frontend/src/lib/publicChannels.ts"
  "docs/PUBLIC_CHANNELS.md"
  "frontend/src/lib/feedFixtures.ts"
  "frontend/src/components/SideFeed.tsx"
  "frontend/src/app/siddes-compose/page.tsx"
  "frontend/src/lib/chips.ts"
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

# Patterns
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

need "frontend/src/lib/feedFixtures.ts" "publicChannel"
need "frontend/src/lib/chips.ts" "export function buildChips"
need "frontend/src/lib/chips.ts" "ChipId.*channel"
need "frontend/src/lib/chips.ts" "FLAGS\.publicChannels"
need "frontend/src/components/SideFeed.tsx" "PUBLIC_CHANNELS"
need "frontend/src/components/SideFeed.tsx" "FLAGS\.publicChannels"
need "frontend/src/app/siddes-compose/page.tsx" "PUBLIC_CHANNELS"
need "frontend/src/app/siddes-compose/page.tsx" "publicChannel"
need "docs/STATE.md" "sd_128"

echo "✅ Public channels foundation check passed"
