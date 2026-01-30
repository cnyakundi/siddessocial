#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Observability baseline (sd_158) =="

MW="backend/siddes_backend/middleware.py"
SETTINGS="backend/siddes_backend/settings.py"

[[ -f "$MW" ]] || { echo "❌ Missing: $MW"; exit 1; }
[[ -f "$SETTINGS" ]] || { echo "❌ Missing: $SETTINGS"; exit 1; }

grep -q "class RequestIdMiddleware" "$MW" || { echo "❌ middleware.py missing RequestIdMiddleware"; exit 1; }
grep -q "class ApiRequestLogMiddleware" "$MW" || { echo "❌ middleware.py missing ApiRequestLogMiddleware"; exit 1; }
grep -q "X-Request-ID" "$MW" || { echo "❌ middleware.py missing X-Request-ID usage"; exit 1; }
echo "✅ backend middleware present"

grep -q "siddes_backend.middleware.RequestIdMiddleware" "$SETTINGS" || { echo "❌ settings.py missing RequestIdMiddleware"; exit 1; }
grep -q "siddes_backend.middleware.ApiRequestLogMiddleware" "$SETTINGS" || { echo "❌ settings.py missing ApiRequestLogMiddleware"; exit 1; }
echo "✅ settings middleware wired"

REQ=(
  "frontend/src/app/error.tsx"
  "frontend/src/app/siddes-feed/error.tsx"
  "frontend/src/app/siddes-post/[id]/error.tsx"
  "frontend/src/app/siddes-circles/error.tsx"
  "frontend/src/app/siddes-circles/[id]/error.tsx"
  "frontend/src/app/siddes-inbox/error.tsx"
  "frontend/src/app/siddes-inbox/[id]/error.tsx"
  "frontend/src/app/siddes-invites/error.tsx"
  "frontend/src/app/invite/[id]/error.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
    grep -q '"use client"' "$f" || { echo "❌ $f missing 'use client'"; exit 1; }
    grep -q "reset" "$f" || { echo "❌ $f missing reset() usage"; exit 1; }
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done
[[ "$missing" -ne 0 ]] && exit 1

echo "✅ frontend error boundaries present"
echo "✅ observability baseline check passed"
