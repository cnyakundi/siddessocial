#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Stub visibility on API feed =="

REQ=(
  "frontend/src/components/StubViewerCookie.tsx"
  "frontend/src/components/AppProviders.tsx"
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
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

if grep -q "sd_viewer" "frontend/src/app/api/feed/route.ts" && grep -q "sd_viewer" "frontend/src/app/api/post/[id]/route.ts"; then
  echo "✅ API routes reference sd_viewer"
else
  echo "❌ API routes do not reference sd_viewer"
  exit 1
fi

if grep -q "StubViewerCookie" "frontend/src/components/AppProviders.tsx"; then
  echo "✅ AppProviders wires StubViewerCookie"
else
  echo "❌ AppProviders does not wire StubViewerCookie"
  exit 1
fi
