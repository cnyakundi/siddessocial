#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Invites Open Circle CTA (sd_141a) =="

need_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "❌ missing: $f"
    exit 1
  fi
  echo "✅ $f"
}

need_pat() {
  local f="$1"
  local pat="$2"
  if ! grep -qF "$pat" "$f"; then
    echo "❌ $f missing: $pat"
    exit 1
  fi
  echo "✅ $f contains: $pat"
}

need_file "frontend/src/app/siddes-invites/page.tsx"
need_file "frontend/src/app/invite/[id]/page.tsx"

need_pat "frontend/src/app/siddes-invites/page.tsx" "Open Circle"
need_pat "frontend/src/app/siddes-invites/page.tsx" "/siddes-circles/"

need_pat "frontend/src/app/invite/[id]/page.tsx" "Open Circle"
need_pat "frontend/src/app/invite/[id]/page.tsx" "/siddes-circles/"

echo "✅ Invites Open Circle CTA check passed"
