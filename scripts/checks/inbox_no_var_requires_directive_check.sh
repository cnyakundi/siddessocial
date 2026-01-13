#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox no-var-requires directive removed =="

FILE="frontend/src/app/siddes-inbox/page.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

if grep -q "@typescript-eslint/no-var-requires" "$FILE"; then
  echo "❌ Found @typescript-eslint/no-var-requires directive"
  exit 1
fi

if grep -q "require(" "$FILE"; then
  echo "❌ Found require() usage"
  exit 1
fi

echo "✅ No directive + no require() usage"
