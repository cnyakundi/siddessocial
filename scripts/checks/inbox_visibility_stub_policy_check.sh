#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox backend_stub visibility shim =="

REQ=(
  "frontend/src/lib/server/inboxVisibility.ts"
  "docs/INBOX_VISIBILITY_STUB.md"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
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

# Ensure the shim contains deterministic test vectors and role mapping.
if grep -q "roleForViewer" "frontend/src/lib/server/inboxVisibility.ts"   && grep -q "allowedSidesForRole" "frontend/src/lib/server/inboxVisibility.ts"   && grep -q "STUB_VISIBILITY_TEST_VECTORS" "frontend/src/lib/server/inboxVisibility.ts"   && grep -q "friends" "frontend/src/lib/server/inboxVisibility.ts"   && grep -q "close" "frontend/src/lib/server/inboxVisibility.ts"   && grep -q "work" "frontend/src/lib/server/inboxVisibility.ts"; then
  echo "✅ Visibility shim role mapping + vectors present"
else
  echo "❌ Visibility shim missing role mapping/vectors"
  exit 1
fi

# Ensure API routes import and use viewerAllowed (not ad-hoc `viewer === me` checks)
if grep -q "inboxVisibility" "frontend/src/app/api/inbox/threads/route.ts"   && grep -q "viewerAllowed" "frontend/src/app/api/inbox/threads/route.ts"   && grep -q "inboxVisibility" "frontend/src/app/api/inbox/thread/[id]/route.ts"   && grep -q "viewerAllowed" "frontend/src/app/api/inbox/thread/[id]/route.ts"; then
  echo "✅ Inbox routes use visibility shim"
else
  echo "❌ Inbox routes not using visibility shim"
  exit 1
fi
