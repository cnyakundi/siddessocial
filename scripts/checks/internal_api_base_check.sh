#!/usr/bin/env bash
set -euo pipefail

echo "== Check: SD_INTERNAL_API_BASE wiring (sd_145a, v2) =="

REQ_PROXY="frontend/src/app/api/auth/_proxy.ts"
if [[ -f "${REQ_PROXY}" ]]; then
  echo "✅ ${REQ_PROXY}"
else
  echo "❌ Missing: ${REQ_PROXY}"
  exit 1
fi

grep -q "SD_INTERNAL_API_BASE" "${REQ_PROXY}" && echo "✅ resolveInternalBase references SD_INTERNAL_API_BASE" || (echo "❌ resolveInternalBase missing SD_INTERNAL_API_BASE" && exit 1)
grep -q "resolveInternalBase" "${REQ_PROXY}" && echo "✅ resolveInternalBase present" || (echo "❌ resolveInternalBase missing" && exit 1)

# Next route handlers must use proxyJson (so they inherit SD_INTERNAL_API_BASE preference)
FILES=(
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
  "frontend/src/app/api/post/[id]/replies/route.ts"
  "frontend/src/app/api/post/[id]/reply/route.ts"
)

for f in "${FILES[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
    grep -q "proxyJson" "${f}" && echo "   ✅ uses proxyJson" || (echo "   ❌ missing proxyJson" && exit 1)
  else
    echo "❌ Missing: ${f}"
    exit 1
  fi
done

# Docker compose must set SD_INTERNAL_API_BASE for frontend
grep -q "SD_INTERNAL_API_BASE" ops/docker/docker-compose.dev.yml && echo "✅ compose wires SD_INTERNAL_API_BASE" || (echo "❌ compose missing SD_INTERNAL_API_BASE" && exit 1)

# Env example must mention SD_INTERNAL_API_BASE
if [[ -f ops/docker/.env.example ]]; then
  grep -q "^SD_INTERNAL_API_BASE=" ops/docker/.env.example && echo "✅ .env.example includes SD_INTERNAL_API_BASE" || (echo "❌ .env.example missing SD_INTERNAL_API_BASE" && exit 1)
else
  echo "❌ Missing: ops/docker/.env.example"
  exit 1
fi

echo "✅ internal api base check passed"
