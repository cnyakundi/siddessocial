#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB debug ops + dual-write (sd_121d) =="

echo ""
REQ=(
  "backend/siddes_inbox/store_db.py"
  "backend/siddes_inbox/store_dualwrite.py"
  "backend/siddes_inbox/views.py"
  "docs/STATE.md"
)

for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ Missing: ${f}"
    exit 1
  fi
done

echo ""
echo "-- DB store must support dev debug operations --"

grep -q "def debug_reset_unread" backend/siddes_inbox/store_db.py && echo "✅ store_db: debug_reset_unread" || (echo "❌ store_db missing debug_reset_unread" && exit 1)
grep -q "def debug_append_incoming" backend/siddes_inbox/store_db.py && echo "✅ store_db: debug_append_incoming" || (echo "❌ store_db missing debug_append_incoming" && exit 1)

echo ""
echo "-- Dual-write flag must be wired in views --"

grep -q "SD_INBOX_DUALWRITE_DB" backend/siddes_inbox/views.py && echo "✅ views: SD_INBOX_DUALWRITE_DB flag" || (echo "❌ views missing SD_INBOX_DUALWRITE_DB flag" && exit 1)
grep -q "DualWriteInboxStore" backend/siddes_inbox/views.py && echo "✅ views: DualWriteInboxStore wiring" || (echo "❌ views missing DualWriteInboxStore wiring" && exit 1)

echo ""
echo "-- STATE doc must mention sd_121d --"

grep -q "sd_121d" docs/STATE.md && echo "✅ docs/STATE.md mentions sd_121d" || (echo "❌ docs/STATE.md missing sd_121d" && exit 1)

echo ""
echo "✅ sd_121d check passed"
