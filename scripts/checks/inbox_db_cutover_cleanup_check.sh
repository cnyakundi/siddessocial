#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB cutover cleanup (sd_122) =="

echo ""
REQ=(
  "backend/siddes_inbox/views.py"
  "backend/siddes_inbox/store_db.py"
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
echo "-- Views: no legacy unread env flags --"
if grep -q "SD_INBOX_DERIVE_UNREAD" backend/siddes_inbox/views.py; then
  echo "❌ views still references SD_INBOX_DERIVE_UNREAD"
  exit 1
fi
if grep -q "SD_INBOX_STOP_WRITE_UNREAD_COUNT" backend/siddes_inbox/views.py; then
  echo "❌ views still references SD_INBOX_STOP_WRITE_UNREAD_COUNT"
  exit 1
fi
echo "✅ views does not reference legacy unread flags"

echo ""
echo "-- Views: DB store constructor is clean --"
if grep -q "DbInboxStore(.*derive_unread" backend/siddes_inbox/views.py; then
  echo "❌ views still passes derive_unread into DbInboxStore"
  exit 1
fi
if grep -q "DbInboxStore(.*write_unread_count" backend/siddes_inbox/views.py; then
  echo "❌ views still passes write_unread_count into DbInboxStore"
  exit 1
fi
grep -q "DbInboxStore()" backend/siddes_inbox/views.py \
  && echo "✅ views uses DbInboxStore()" \
  || (echo "❌ views does not appear to use DbInboxStore()" && exit 1)

echo ""
echo "-- Store: no legacy unread constructor toggles --"
if grep -q "def __init__(self,.*derive_unread" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db __init__ still has derive_unread param"
  exit 1
fi
if grep -q "self\._derive_unread[[:space:]]*=" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still assigns self._derive_unread"
  exit 1
fi
if grep -q "write_unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still mentions write_unread_count"
  exit 1
fi
if grep -q "_write_unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still tracks _write_unread_count"
  exit 1
fi
echo "✅ store_db is free of legacy unread toggles"

echo ""
echo "-- STATE doc must mention sd_122 --"
grep -q "sd_122" docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_122" \
  || (echo "❌ docs/STATE.md missing sd_122" && exit 1)

echo ""
echo "✅ sd_122 check passed"
