#!/usr/bin/env bash
set -euo pipefail

echo "== Check: SD_INTERNAL_API_BASE wiring (sd_145a) =="

# Next route handlers must prefer SD_INTERNAL_API_BASE
FILES=(
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
  "frontend/src/app/api/post/[id]/replies/route.ts"
  "frontend/src/app/api/post/[id]/reply/route.ts"
)

missing=0
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
    grep -q "SD_INTERNAL_API_BASE" "$f" && echo "   ✅ uses SD_INTERNAL_API_BASE" || (echo "   ❌ missing SD_INTERNAL_API_BASE" && exit 1)
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done
[[ "$missing" -ne 0 ]] && exit 1

# Docker compose must set SD_INTERNAL_API_BASE for frontend
grep -q "SD_INTERNAL_API_BASE" ops/docker/docker-compose.dev.yml && echo "✅ compose wires SD_INTERNAL_API_BASE" || (echo "❌ compose missing SD_INTERNAL_API_BASE" && exit 1)

# Env example must mention SD_INTERNAL_API_BASE
grep -q "^SD_INTERNAL_API_BASE=" ops/docker/.env.example && echo "✅ .env.example includes SD_INTERNAL_API_BASE" || (echo "❌ .env.example missing SD_INTERNAL_API_BASE" && exit 1)

echo "✅ internal api base check passed"
