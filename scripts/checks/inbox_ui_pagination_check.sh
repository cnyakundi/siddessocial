#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox UI pagination (backend_stub) =="

REQ=(
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
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

# Provider opts include cursor + limit
if grep -qF "cursor?:" "frontend/src/lib/inboxProvider.ts"   && grep -qF "limit?:" "frontend/src/lib/inboxProvider.ts"   && grep -q "nextCursor" "frontend/src/lib/inboxProvider.ts"   && grep -q "hasMore" "frontend/src/lib/inboxProvider.ts"; then
  echo "✅ Provider pagination types present"
else
  echo "❌ Provider pagination types missing"
  exit 1
fi

# Backend stub builds cursor param
if grep -qF 'searchParams.set("cursor"' "frontend/src/lib/inboxProviders/backendStub.ts"   && grep -qF 'searchParams.set("limit"' "frontend/src/lib/inboxProviders/backendStub.ts"; then
  echo "✅ backend_stub provider passes cursor/limit"
else
  echo "❌ backend_stub provider missing cursor/limit param passing"
  exit 1
fi

# UI has Load more
if grep -q "Load more" "frontend/src/app/siddes-inbox/page.tsx"   && grep -q "inbox-load-more" "frontend/src/app/siddes-inbox/page.tsx"; then
  echo "✅ Inbox list Load more UI present"
else
  echo "❌ Missing Load more UI"
  exit 1
fi
