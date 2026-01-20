#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox provider + Next proxy routes (v3) =="

REQ=(
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
  "frontend/src/lib/server/inboxStore.ts"
)

for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ Missing: ${f}"
    exit 1
  fi
done

# Provider selection env var
if grep -q "NEXT_PUBLIC_INBOX_PROVIDER" "frontend/src/lib/inboxProvider.ts" && grep -q "backend_stub" "frontend/src/lib/inboxProvider.ts"; then
  echo "✅ Inbox provider selection present"
else
  echo "❌ Inbox provider selection missing"
  exit 1
fi

# API routes should use proxyJson (cookie-forwarding handled centrally)
grep -q "proxyJson" "frontend/src/app/api/inbox/threads/route.ts" && echo "✅ /api/inbox/threads uses proxyJson" || (echo "❌ /api/inbox/threads missing proxyJson" && exit 1)
grep -q "proxyJson" "frontend/src/app/api/inbox/thread/[id]/route.ts" && echo "✅ /api/inbox/thread/[id] uses proxyJson" || (echo "❌ /api/inbox/thread/[id] missing proxyJson" && exit 1)

echo "✅ inbox provider check passed"
