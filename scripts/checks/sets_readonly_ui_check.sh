#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets UI read-only for non-owner viewers (sd_139b) =="

need_file () {
  local p="$1"
  if [[ -f "${p}" ]]; then
    echo "✅ ${p}"
  else
    echo "❌ Missing: ${p}"
    exit 1
  fi
}

need_grep () {
  local p="$1"
  local pat="$2"
  if grep -q "${pat}" "${p}"; then
    echo "✅ ${p} contains: ${pat}"
  else
    echo "❌ ${p} missing: ${pat}"
    exit 1
  fi
}

need_file "frontend/src/lib/stubViewerClient.ts"
need_file "frontend/src/app/siddes-sets/page.tsx"
need_file "frontend/src/app/siddes-sets/[id]/page.tsx"

need_grep "frontend/src/app/siddes-sets/page.tsx" "Read-only: you are viewing as"
need_grep "frontend/src/app/siddes-sets/page.tsx" "Create disabled (read-only)"

need_grep "frontend/src/app/siddes-sets/[id]/page.tsx" "Joined as"
need_grep "frontend/src/app/siddes-sets/[id]/page.tsx" "disabled={saving || !item || !canWrite}"
need_grep "frontend/src/app/siddes-sets/[id]/page.tsx" "disabled={!item || !canWrite}"

echo "✅ Sets read-only UI check passed"
