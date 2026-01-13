#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread header uses participant displayName =="

THREAD="frontend/src/app/siddes-inbox/[id]/page.tsx"

if [[ ! -f "$THREAD" ]]; then
  echo "❌ Missing: $THREAD"
  exit 1
fi

if grep -q "participantDisplayName" "$THREAD" && grep -q "participant?.displayName" "$THREAD"; then
  echo "✅ Thread page tracks participant displayName"
else
  echo "❌ Thread page missing participant displayName wiring"
  exit 1
fi

if grep -q "{participantDisplayName || title}" "$THREAD"; then
  echo "✅ Thread header renders participantDisplayName with fallback to title"
else
  echo "❌ Thread header not rendering participantDisplayName fallback"
  exit 1
fi
