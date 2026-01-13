#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox provider + backend stub routes =="
echo "• inbox_provider_check v2 (resolveStubViewer-aware)"


REQ=(
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/mock.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
  "frontend/src/lib/server/inboxStore.ts"
  "frontend/src/lib/mockInbox.ts"
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

# Provider selection env var
if grep -q "NEXT_PUBLIC_INBOX_PROVIDER" "frontend/src/lib/inboxProvider.ts"   && grep -q "backend_stub" "frontend/src/lib/inboxProvider.ts"; then
  echo "✅ Inbox provider selection present"
else
  echo "❌ Inbox provider selection missing"
  exit 1
fi

# Default-safe gating in API routes
#
# Legacy stubs used to reference the sd_viewer cookie directly.
# Newer stubs must use resolveStubViewer(), which reads cookie/header safely
# and enforces "missing viewer => restricted" semantics.
if grep -q "resolveStubViewer" "frontend/src/app/api/inbox/threads/route.ts" \
  && grep -q "resolveStubViewer" "frontend/src/app/api/inbox/thread/[id]/route.ts"; then
  echo "✅ API routes use resolveStubViewer (default-safe gating)"
elif grep -q "sd_viewer" "frontend/src/app/api/inbox/threads/route.ts" \
  && grep -q "sd_viewer" "frontend/src/app/api/inbox/thread/[id]/route.ts"; then
  echo "✅ API routes reference sd_viewer (legacy default-safe gating)"
else
  echo "❌ API routes missing stub viewer gating (resolveStubViewer)"
  exit 1
fi

# mockInbox has lockedSide field
if grep -q "lockedSide" "frontend/src/lib/mockInbox.ts"; then
  echo "✅ mockInbox includes lockedSide"
else
  echo "❌ mockInbox missing lockedSide"
  exit 1
fi
