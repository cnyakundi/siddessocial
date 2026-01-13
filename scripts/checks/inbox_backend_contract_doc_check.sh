#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox backend contract doc =="

REQ=(
  "docs/INBOX_BACKEND_CONTRACT.md"
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

FILE="docs/INBOX_BACKEND_CONTRACT.md"

# Must define provider mapping and all four operations.
if grep -q "Provider → endpoint map" "$FILE" \
  && grep -q "GET /api/inbox/threads" "$FILE" \
  && grep -q "GET /api/inbox/thread/:id" "$FILE" \
  && grep -q "Send message" "$FILE" \
  && grep -q "Set locked side" "$FILE"; then
  echo "✅ Contract sections present"
else
  echo "❌ Missing required contract sections"
  exit 1
fi

# Must mention cursor/pagination as opaque.
if grep -qi "cursor" "$FILE" && grep -qi "opaque" "$FILE"; then
  echo "✅ Cursor/pagination contract present"
else
  echo "❌ Cursor/pagination contract missing"
  exit 1
fi
