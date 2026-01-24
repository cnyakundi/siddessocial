#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox backend_stub debug panel + params =="

REQ=(
  "frontend/src/components/InboxStubDebugPanel.tsx"
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
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

# Provider supports viewer/side params.
# IMPORTANT: Viewer should be forwarded via the `x-sd-viewer` header (not a URL query param).
if grep -q "InboxProviderListOpts" "frontend/src/lib/inboxProvider.ts" \
  && grep -qF "viewer?:" "frontend/src/lib/inboxProvider.ts" \
  && grep -qF "side?:" "frontend/src/lib/inboxProvider.ts" \
  && grep -q "buildUrl" "frontend/src/lib/inboxProviders/backendStub.ts" \
  && grep -qF 'searchParams.set("side"' "frontend/src/lib/inboxProviders/backendStub.ts" \
  && grep -q "x-sd-viewer" "frontend/src/lib/inboxProviders/backendStub.ts"; then
  echo "✅ backend_stub provider supports viewer + side params (via x-sd-viewer header)"
else
  echo "❌ backend_stub provider missing viewer/side support (header-based)"
  exit 1
fi

# UI passes params
if grep -q "provider.listThreads({ viewer, side:" "frontend/src/app/siddes-inbox/page.tsx" \
  && grep -q "provider.getThread(id, { viewer" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ UI passes viewer/side params to provider"
else
  echo "❌ UI not passing viewer/side params"
  exit 1
fi

# Debug panel wired
if grep -q "InboxStubDebugPanel" "frontend/src/app/siddes-inbox/page.tsx" \
  && grep -q "InboxStubDebugPanel" "frontend/src/app/siddes-inbox/[id]/page.tsx"; then
  echo "✅ Debug panel wired into inbox pages"
else
  echo "❌ Debug panel not wired into inbox pages"
  exit 1
fi
