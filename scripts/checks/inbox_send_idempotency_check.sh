#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox send idempotency (clientKey) (sd_751 + sd_753 hardening) =="

F="frontend/src/lib/inboxProviders/backendStub.ts"
M="backend/siddes_inbox/store_memory.py"
D="backend/siddes_inbox/store_db.py"

[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
[[ -f "$M" ]] || { echo "❌ Missing: $M"; exit 1; }
[[ -f "$D" ]] || { echo "❌ Missing: $D"; exit 1; }

grep -q "sd_751_inbox_send_idempotency" "$F" || { echo "❌ frontend missing sd_751_inbox_send_idempotency"; exit 1; }
grep -q "clientKey" "$F" || { echo "❌ frontend does not send clientKey"; exit 1; }

# MUST NOT be at global scope (indent 0)
if grep -q '^# sd_751_inbox_send_idempotency' "$M"; then
  echo "❌ store_memory has sd_751 marker at global scope (would break Python)"
  exit 1
fi
if grep -q '^# sd_751_inbox_send_idempotency' "$D"; then
  echo "❌ store_db has sd_751 marker at global scope (would break Python)"
  exit 1
fi

# MUST be inside send_message() body (8-space indent inside class method)
grep -q '^        # sd_751_inbox_send_idempotency' "$M" || { echo "❌ store_memory sd_751 marker is not indented into send_message()"; exit 1; }
grep -q '^        # sd_751_inbox_send_idempotency' "$D" || { echo "❌ store_db sd_751 marker is not indented into send_message()"; exit 1; }

echo "✅ inbox send idempotency present (and not at global scope)"
