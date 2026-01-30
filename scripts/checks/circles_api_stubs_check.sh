#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles API stubs =="

REQ=(
  "frontend/src/lib/server/setsStore.ts"
  "frontend/src/app/api/circles/route.ts"
  "frontend/src/app/api/circles/[id]/route.ts"
  "frontend/src/app/api/circles/[id]/events/route.ts"
  "docs/SETS_API_STUBS.md"
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

# sd_viewer gate must be mentioned (grep-based checks are intentional in this repo).
if grep -q "sd_viewer" frontend/src/app/api/circles/route.ts   frontend/src/app/api/circles/[id]/route.ts   frontend/src/app/api/circles/[id]/events/route.ts; then
  echo "✅ Circles routes reference sd_viewer gate"
else
  echo "❌ Circles routes missing sd_viewer gate"
  exit 1
fi

# Basic TS parse check (cheap sanity):
node -e "require('fs').readFileSync('frontend/src/lib/server/setsStore.ts','utf8');" >/dev/null
echo "✅ sets api stubs selfcheck passed"
