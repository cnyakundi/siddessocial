#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Next auth routes present (sd_161c) =="

REQ=(
  "frontend/src/app/api/auth/_proxy.ts"
  "frontend/src/app/api/auth/login/route.ts"
  "frontend/src/app/api/auth/signup/route.ts"
  "frontend/src/app/api/auth/logout/route.ts"
  "frontend/src/app/api/auth/me/route.ts"
  "frontend/src/app/api/auth/google/route.ts"
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
[[ "$missing" -ne 0 ]] && exit 1

grep -q "SD_INTERNAL_API_BASE" frontend/src/app/api/auth/_proxy.ts || { echo "❌ _proxy.ts missing base resolution"; exit 1; }

echo "✅ next auth routes present"
