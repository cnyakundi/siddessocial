#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox debug thread picker =="

REQ=("frontend/src/components/InboxStubDebugPanel.tsx")

if [[ ! -f "${REQ[0]}" ]]; then
  echo "❌ Missing: ${REQ[0]}"
  exit 1
fi

if grep -q "selectedThread" "frontend/src/components/InboxStubDebugPanel.tsx"   && grep -q "Select thread" "frontend/src/components/InboxStubDebugPanel.tsx"   && grep -q "t_friends2" "frontend/src/components/InboxStubDebugPanel.tsx"   && grep -q "threadId: selectedThread" "frontend/src/components/InboxStubDebugPanel.tsx"; then
  echo "✅ Debug thread picker present + wired"
else
  echo "❌ Debug thread picker missing or not wired"
  exit 1
fi
