#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB remove read-state unread_count (sd_121j) =="

echo ""
REQ=(
  "backend/siddes_inbox/models.py"
  "backend/siddes_inbox/store_db.py"
  "backend/siddes_inbox/management/commands/seed_inbox_demo.py"
  "backend/siddes_inbox/migrations/0004_remove_inboxthreadreadstate_unread_count.py"
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
echo "-- Models: InboxThreadReadState must NOT define unread_count field --"
if grep -q "unread_count[[:space:]]*=[[:space:]]*models" backend/siddes_inbox/models.py; then
  echo "❌ models.py still defines unread_count field"
  exit 1
fi
echo "✅ models.py does not define unread_count"

echo ""
echo "-- Migration: remove unread_count from InboxThreadReadState --"
grep -q "RemoveField" backend/siddes_inbox/migrations/0004_remove_inboxthreadreadstate_unread_count.py \
  && echo "✅ migration contains RemoveField" \
  || (echo "❌ migration missing RemoveField" && exit 1)

grep -q "model_name=\"inboxthreadreadstate\"" backend/siddes_inbox/migrations/0004_remove_inboxthreadreadstate_unread_count.py \
  && echo "✅ migration targets InboxThreadReadState" \
  || (echo "❌ migration does not target InboxThreadReadState" && exit 1)

grep -q "name=\"unread_count\"" backend/siddes_inbox/migrations/0004_remove_inboxthreadreadstate_unread_count.py \
  && echo "✅ migration removes unread_count" \
  || (echo "❌ migration does not remove unread_count" && exit 1)

echo ""
echo "-- Store: must not read/write InboxThreadReadState.unread_count --"
if grep -q "values_list(\"thread_id\", \"unread_count\"" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still selects unread_count"
  exit 1
fi
if grep -q "defaults\[\"unread_count\"\]" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still writes defaults[\"unread_count\"]"
  exit 1
fi
if grep -q "getattr(.*unread_count" backend/siddes_inbox/store_db.py; then
  echo "❌ store_db still reads unread_count via getattr"
  exit 1
fi
echo "✅ store_db does not read/write read-state unread_count"

echo ""
echo "-- Seeder: must not set unread_count --"
if grep -q "unread_count" backend/siddes_inbox/management/commands/seed_inbox_demo.py; then
  echo "❌ seed_inbox_demo still mentions unread_count"
  exit 1
fi
echo "✅ seed_inbox_demo does not mention unread_count"

echo ""
echo "-- STATE doc must mention sd_121j --"
grep -q "sd_121j" docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_121j" \
  || (echo "❌ docs/STATE.md missing sd_121j" && exit 1)

echo ""
echo "✅ sd_121j check passed"
