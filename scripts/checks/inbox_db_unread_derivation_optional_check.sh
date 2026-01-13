#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB unread derivation optional (sd_121h) =="

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
echo "-- Views: derived unread is now always-on (sd_121j+) --"
if grep -q "SD_INBOX_DERIVE_UNREAD" backend/siddes_inbox/views.py; then
  echo "❌ views still references SD_INBOX_DERIVE_UNREAD (should be removed in sd_122)"
  exit 1
fi
echo "✅ views does not reference SD_INBOX_DERIVE_UNREAD"

if grep -q "derive_unread=" backend/siddes_inbox/views.py; then
  echo "❌ views still passes derive_unread into DbInboxStore (should be removed in sd_122)"
  exit 1
fi
echo "✅ views does not pass derive_unread into DbInboxStore"

echo ""
echo "-- DB store must implement derived unread path --"
grep -q "def _derive_unread_map_for_threads" backend/siddes_inbox/store_db.py \
  && echo "✅ store_db: _derive_unread_map_for_threads" \
  || (echo "❌ store_db missing _derive_unread_map_for_threads" && exit 1)

grep -q "last_read_ts" backend/siddes_inbox/store_db.py \
  && echo "✅ store_db: reads last_read_ts" \
  || (echo "❌ store_db does not read last_read_ts" && exit 1)

grep -q "from_id=\"them\"" backend/siddes_inbox/store_db.py \
  && echo "✅ store_db: counts incoming messages (from_id=\"them\")" \
  || (echo "❌ store_db does not appear to count incoming messages" && exit 1)

echo ""
echo "-- STATE doc must mention sd_121h --"
grep -q "sd_121h" docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_121h" \
  || (echo "❌ docs/STATE.md missing sd_121h" && exit 1)

echo ""
echo "✅ sd_121h check passed"
