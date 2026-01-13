#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox avatar uses side theme tokens + avatarSeed variation =="

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

# Inbox list: avatar tinted by lockedSide theme + seeded variation hook.
if grep -q "SIDE_THEMES\[sideId\]" "$LIST" && grep -q "participant?.avatarSeed" "$LIST" && grep -q "seed=" "$LIST"; then
  echo "✅ Inbox list avatar uses theme tokens + passes avatarSeed"
else
  echo "❌ Inbox list avatar missing theme tokens or avatarSeed wiring"
  exit 1
fi

# Thread header: avatar tinted by lockedSide theme + uses participantSeed derived from participant.avatarSeed.
if grep -q "SIDE_THEMES\[sideId\]" "$THREAD" && grep -q "participant?.avatarSeed" "$THREAD" && grep -q "seed={participantSeed}" "$THREAD"; then
  echo "✅ Thread header avatar uses theme tokens + avatarSeed variation"
else
  echo "❌ Thread header avatar missing theme tokens or avatarSeed variation"
  exit 1
fi
