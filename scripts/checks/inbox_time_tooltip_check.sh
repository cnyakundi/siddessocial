#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox time tooltip =="

FILE="frontend/src/app/siddes-inbox/page.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "formatAbsTime" "$FILE" && grep -q "title={formatAbsTime" "$FILE"; then
  echo "✅ Absolute time tooltip present"
else
  echo "❌ Missing absolute time tooltip"
  exit 1
fi
