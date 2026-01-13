#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB unread per-viewer scaffold (sd_121e) =="

echo ""
REQ=(
  "backend/siddes_inbox/models.py"
  "backend/siddes_inbox/store_db.py"
  "backend/siddes_inbox/management/commands/seed_inbox_demo.py"
  "backend/siddes_inbox/migrations/0002_inboxthreadreadstate.py"
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
echo "-- Models: per-viewer read state exists --"
grep -q "class InboxThreadReadState" backend/siddes_inbox/models.py && echo "✅ models: InboxThreadReadState" || (echo "❌ models missing InboxThreadReadState" && exit 1)

echo ""
echo "-- DB store must use per-viewer unread --"
grep -q "InboxThreadReadState" backend/siddes_inbox/store_db.py && echo "✅ store_db: uses InboxThreadReadState" || (echo "❌ store_db missing InboxThreadReadState usage" && exit 1)
grep -q "_unread_map_for_threads" backend/siddes_inbox/store_db.py && echo "✅ store_db: unread map helper" || (echo "❌ store_db missing unread map helper" && exit 1)

echo ""
echo "-- Seeder must populate per-viewer unread --"
grep -q "InboxThreadReadState" backend/siddes_inbox/management/commands/seed_inbox_demo.py && echo "✅ seed_inbox_demo: seeds InboxThreadReadState" || (echo "❌ seed_inbox_demo missing read state" && exit 1)

echo ""
echo "-- STATE doc must mention sd_121e --"
grep -q "sd_121e" docs/STATE.md && echo "✅ docs/STATE.md mentions sd_121e" || (echo "❌ docs/STATE.md missing sd_121e" && exit 1)

echo ""
echo "✅ sd_121e check passed"
