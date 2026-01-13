#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Slate + Pinned Stack (sd_131) =="

REQ=(
  "frontend/src/components/PinnedStack.tsx"
  "frontend/src/components/PublicSlate.tsx"
  "frontend/src/components/ProfileView.tsx"
  "frontend/src/lib/mockPublicSlate.ts"
  "frontend/src/lib/mockUsers.ts"
  "docs/PUBLIC_SLATE.md"
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

need "frontend/src/components/ProfileView.tsx" "FLAGS\.publicSlate"
need "frontend/src/components/ProfileView.tsx" "<PinnedStack"
need "frontend/src/components/ProfileView.tsx" "<PublicSlate"
need "frontend/src/lib/mockUsers.ts" "pinnedStack"
need "frontend/src/lib/mockPublicSlate.ts" "MOCK_PUBLIC_SLATE"
need "docs/STATE.md" "sd_131"
need "docs/PUBLIC_SLATE.md" "sd_131"

echo "✅ Public Slate check passed"
