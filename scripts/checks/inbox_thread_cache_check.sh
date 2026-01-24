#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread cache =="

REQ=(
  "frontend/src/lib/inboxCache.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
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

if grep -q "makeThreadCacheKey" "frontend/src/lib/inboxCache.ts"   && grep -q "TTL_MS" "frontend/src/lib/inboxCache.ts"   && grep -q "getCachedThread" "frontend/src/lib/inboxProviders/backendStub.ts"   && grep -q "setCachedThread" "frontend/src/lib/inboxProviders/backendStub.ts"; then
  echo "✅ Cache key + TTL + provider integration present"
else
  echo "❌ Cache integration missing"
  exit 1
fi

# Ensure we don't cache restricted
if grep -q "restricted" "frontend/src/lib/inboxProviders/backendStub.ts"   && grep -q "Don't cache restricted" "frontend/src/lib/inboxProviders/backendStub.ts"; then
  echo "✅ Restricted responses not cached"
else
  echo "❌ Restricted cache safety missing"
  exit 1
fi
