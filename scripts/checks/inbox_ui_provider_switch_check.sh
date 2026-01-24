#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox UI uses inboxProvider in backend_stub mode =="

LIST="frontend/src/app/siddes-inbox/page.tsx"
THREAD="frontend/src/app/siddes-inbox/[id]/page.tsx"

if [[ ! -f "$LIST" ]]; then
  echo "❌ Missing: $LIST"
  exit 1
fi
if [[ ! -f "$THREAD" ]]; then
  echo "❌ Missing: $THREAD"
  exit 1
fi

if grep -q "getInboxProvider" "$LIST" && grep -q "provider.listThreads" "$LIST"; then
  echo "✅ Inbox list provider wiring present"
else
  echo "❌ Inbox list not wired to inboxProvider"
  exit 1
fi

if grep -q "getInboxProvider" "$THREAD"   && grep -q "provider.getThread" "$THREAD"   && grep -q "provider.sendMessage" "$THREAD"   && grep -q "provider.setLockedSide" "$THREAD"; then
  echo "✅ Thread page provider wiring present"
else
  echo "❌ Thread page not wired to inboxProvider"
  exit 1
fi
