#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB stop writing unread_count optional (sd_121i) =="

echo ""
REQ=(
  "backend/siddes_inbox/store_db.py"
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
echo "-- sd_121j+ cleanup: stop-write toggle is removed (sd_122) --"
if grep -q "SD_INBOX_STOP_WRITE_UNREAD_COUNT" backend/siddes_inbox/views.py; then
  echo "❌ views still references SD_INBOX_STOP_WRITE_UNREAD_COUNT (should be removed in sd_122)"
  exit 1
fi
echo "✅ views does not reference SD_INBOX_STOP_WRITE_UNREAD_COUNT"

if grep -q "DERIVE_UNREAD_EFFECTIVE" backend/siddes_inbox/views.py; then
  echo "❌ views still defines DERIVE_UNREAD_EFFECTIVE (should be removed in sd_122)"
  exit 1
fi
echo "✅ views does not define DERIVE_UNREAD_EFFECTIVE"

if grep -q "write_unread_count" backend/siddes_inbox/views.py; then
  echo "❌ views still passes write_unread_count into DbInboxStore (should be removed in sd_122)"
  exit 1
fi
echo "✅ views does not pass write_unread_count into DbInboxStore"

echo ""
echo "-- DB store must not carry write_unread_count toggle --"
if grep -q "write_unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still mentions write_unread_count (should be removed in sd_122)"
  exit 1
fi
echo "✅ store_db does not mention write_unread_count"

if grep -q "_write_unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still tracks _write_unread_count (should be removed in sd_122)"
  exit 1
fi
echo "✅ store_db does not track _write_unread_count"

echo ""
echo "-- STATE doc must mention sd_121i --"
grep -q "sd_121i" docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_121i" \
  || (echo "❌ docs/STATE.md missing sd_121i" && exit 1)

echo ""
echo "✅ sd_121i check passed"
