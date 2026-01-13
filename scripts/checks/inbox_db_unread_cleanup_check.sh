#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB unread cleanup (sd_121f) =="

echo ""
REQ=(
  "backend/siddes_inbox/models.py"
  "backend/siddes_inbox/store_db.py"
  "backend/siddes_inbox/management/commands/seed_inbox_demo.py"
  "backend/siddes_inbox/migrations/0003_remove_inboxthread_unread_count.py"
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
echo "-- Models: InboxThread must NOT have unread_count --"
THREAD_BLOCK="$(awk '/^class InboxThread\(/,/^class InboxMessage\(/' backend/siddes_inbox/models.py)"
if echo "${THREAD_BLOCK}" | grep -q "unread_count"; then
  echo "❌ InboxThread still references unread_count"
  exit 1
fi
echo "✅ InboxThread has no unread_count"

echo ""
echo "-- Migration: remove unread_count field --"
grep -q "RemoveField" backend/siddes_inbox/migrations/0003_remove_inboxthread_unread_count.py && echo "✅ migration contains RemoveField" || (echo "❌ migration missing RemoveField" && exit 1)
grep -q "name=\"unread_count\"" backend/siddes_inbox/migrations/0003_remove_inboxthread_unread_count.py && echo "✅ migration removes unread_count" || (echo "❌ migration does not remove unread_count" && exit 1)

echo ""
echo "-- Store/seeder must not touch InboxThread.unread_count --"
if grep -q "InboxThread\.unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still references InboxThread.unread_count"
  exit 1
fi
if grep -q "t\.unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still assigns t.unread_count"
  exit 1
fi
if grep -q "unread_count=" backend/siddes_inbox/management/commands/seed_inbox_demo.py; then
  echo "❌ seed_inbox_demo still passes unread_count=..."
  exit 1
fi
echo "✅ store_db + seed_inbox_demo do not touch thread unread_count"

echo ""
echo "-- STATE doc must mention sd_121f --"
grep -q "sd_121f" docs/STATE.md && echo "✅ docs/STATE.md mentions sd_121f" || (echo "❌ docs/STATE.md missing sd_121f" && exit 1)

echo ""
echo "✅ sd_121f check passed"
