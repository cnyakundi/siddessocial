#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug panel hits Django DRF when configured (sd_114) =="

REQ=(
  "frontend/src/components/InboxStubDebugPanel.tsx"
  "backend/siddes_inbox/views.py"
  "backend/siddes_inbox/urls.py"
  "backend/siddes_inbox/store_memory.py"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ missing: ${f}"
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

if grep -q "NEXT_PUBLIC_API_BASE" frontend/src/components/InboxStubDebugPanel.tsx; then
  echo "✅ debug panel references NEXT_PUBLIC_API_BASE"
else
  echo "❌ debug panel does not reference NEXT_PUBLIC_API_BASE"
  exit 1
fi

if grep -q "fetchWithFallback(\"/api/inbox/debug/unread/reset\"" frontend/src/components/InboxStubDebugPanel.tsx \
  && grep -q "fetchWithFallback(\"/api/inbox/debug/incoming\"" frontend/src/components/InboxStubDebugPanel.tsx; then
  echo "✅ debug panel server controls use fetchWithFallback()"
else
  echo "❌ debug panel server controls are not using fetchWithFallback()"
  exit 1
fi

if grep -q "InboxDebugResetUnreadView" backend/siddes_inbox/views.py \
  && grep -q "InboxDebugIncomingView" backend/siddes_inbox/views.py; then
  echo "✅ backend defines DRF debug views"
else
  echo "❌ backend missing DRF debug views"
  exit 1
fi

if grep -q "debug/unread/reset" backend/siddes_inbox/urls.py \
  && grep -q "debug/incoming" backend/siddes_inbox/urls.py; then
  echo "✅ backend urls expose /api/inbox/debug/* endpoints"
else
  echo "❌ backend urls missing debug endpoints"
  exit 1
fi

if grep -q "debug_reset_unread" backend/siddes_inbox/store_memory.py \
  && grep -q "debug_append_incoming" backend/siddes_inbox/store_memory.py; then
  echo "✅ in-memory store supports debug operations"
else
  echo "❌ in-memory store missing debug operations"
  exit 1
fi

echo "✅ sd_114 check passed"
