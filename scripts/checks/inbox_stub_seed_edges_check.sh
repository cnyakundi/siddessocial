#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox backend stub seed expansion =="

REQ=(
  "frontend/src/lib/server/inboxStore.ts"
  "scripts/dev/inbox_stub_smoke_demo.py"
  "docs/INBOX_STUB_SMOKE_DEMO.md"
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

# Ensure edge-case thread ids are present in seed file
if grep -q "t_public_empty" "frontend/src/lib/server/inboxStore.ts"   && grep -q "t_long" "frontend/src/lib/server/inboxStore.ts"   && grep -q "t_close2" "frontend/src/lib/server/inboxStore.ts"   && grep -q "t_work2" "frontend/src/lib/server/inboxStore.ts"; then
  echo "✅ Edge-case seeds present"
else
  echo "❌ Expected edge-case seeds missing"
  exit 1
fi
