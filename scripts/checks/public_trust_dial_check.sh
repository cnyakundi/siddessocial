#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Trust Dial MVP (sd_130) =="

REQ=(
  "frontend/src/lib/publicTrustDial.ts"
  "frontend/src/lib/trustLevels.ts"
  "frontend/src/lib/mockFeed.ts"
  "frontend/src/components/SideFeed.tsx"
  "docs/PUBLIC_TRUST_DIAL.md"
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

need "frontend/src/lib/publicTrustDial.ts" "sd\.publicTrustDial\.v0"
need "frontend/src/lib/publicTrustDial.ts" "minTrustForMode"
need "frontend/src/components/SideFeed.tsx" "FLAGS\.publicTrustDial"
need "frontend/src/components/SideFeed.tsx" "applyTrustMode"
need "frontend/src/lib/mockFeed.ts" "trustLevel"
need "docs/STATE.md" "sd_130"
need "docs/PUBLIC_TRUST_DIAL.md" "sd_130"

echo "✅ Public Trust Dial check passed"
