#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Slate + Pinned Stack (sd_131) [DB-backed sd_181i] =="

REQ=(
  "frontend/src/components/PinnedStack.tsx"
  "frontend/src/components/PublicSlate.tsx"
  "frontend/src/components/ProfileView.tsx"
  "frontend/src/app/api/slate/route.ts"
  "backend/siddes_slate/models.py"
  "backend/siddes_slate/views.py"
  "backend/siddes_slate/urls.py"
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
need "frontend/src/components/PublicSlate.tsx" "\\/api\\/slate"
need "frontend/src/app/api/slate/route.ts" "\\/api\\/slate"
need "backend/siddes_slate/views.py" "PublicSlateListView"
need "backend/siddes_slate/urls.py" "path\\(\\\"slate\\\""
need "docs/STATE.md" "sd_131"
need "docs/PUBLIC_SLATE.md" "sd_131"

# Ensure we are no longer depending on mockPublicSlate.
if [[ -f "frontend/src/lib/mockPublicSlate.ts" ]]; then
  echo "❌ frontend/src/lib/mockPublicSlate.ts should be removed (DB-backed slate)"
  exit 1
fi

echo "✅ Public Slate check passed"
