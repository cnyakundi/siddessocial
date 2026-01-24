#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DB store (sd_121b) =="
echo ""

REQ_FILES=(
  "backend/siddes_inbox/store_db.py"
  "backend/siddes_inbox/views.py"
  "docs/STATE.md"
)

for f in "${REQ_FILES[@]}"; do
  if [[ ! -f "${f}" ]]; then
    echo "❌ Missing: ${f}"
    exit 1
  fi
  echo "✅ ${f}"
done

echo ""
echo "-- Views must recognize SD_INBOX_STORE=db --"
grep -q "DbInboxStore" backend/siddes_inbox/views.py && echo "✅ DbInboxStore import present" || (echo "❌ DbInboxStore import missing" && exit 1)
grep -q "SD_INBOX_STORE" backend/siddes_inbox/views.py && echo "✅ SD_INBOX_STORE wiring present" || (echo "❌ SD_INBOX_STORE wiring missing" && exit 1)
grep -q "USE_DB" backend/siddes_inbox/views.py && echo "✅ USE_DB mode present" || (echo "❌ USE_DB mode missing" && exit 1)

echo ""
echo "✅ Inbox DB store check passed"
