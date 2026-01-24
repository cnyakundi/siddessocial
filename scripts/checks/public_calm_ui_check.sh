#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Visual Calm (sd_132) =="

REQ=(
  "frontend/src/lib/flags.ts"
  "frontend/src/lib/publicCalmUi.ts"
  "frontend/src/components/SideFeed.tsx"
  "frontend/src/components/PostCard.tsx"
  "docs/PUBLIC_CALM_UI.md"
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

need "frontend/src/lib/flags.ts" "publicCalmUi"
need "frontend/src/lib/publicCalmUi.ts" "sd\.publicCalmUi\.v0"
need "frontend/src/lib/publicCalmUi.ts" "EVT_PUBLIC_CALM_UI_CHANGED"
need "frontend/src/components/SideFeed.tsx" "FLAGS\.publicCalmUi"
need "frontend/src/components/SideFeed.tsx" "savePublicCalmUi"
need "frontend/src/components/PostCard.tsx" "calmHideCounts"
need "frontend/src/components/PostCard.tsx" "group-hover:opacity-100"
need "docs/STATE.md" "sd_132"
need "docs/PUBLIC_CALM_UI.md" "sd_132"

echo "✅ Public Visual Calm check passed"
