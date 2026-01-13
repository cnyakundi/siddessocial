#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox store quickstart doc (sd_125) =="

echo ""
REQ=(
  "docs/INBOX_DB.md"
  "docs/INBOX_BACKEND_CONTRACT.md"
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
echo "-- Quickstart doc must mention store modes + seed helpers --"
grep -q 'SD_INBOX_STORE' docs/INBOX_DB.md   && echo "✅ SD_INBOX_STORE mentioned"   || (echo "❌ SD_INBOX_STORE missing from docs/INBOX_DB.md" && exit 1)

grep -q 'SD_INBOX_DUALWRITE_DB' docs/INBOX_DB.md   && echo "✅ SD_INBOX_DUALWRITE_DB mentioned"   || (echo "❌ SD_INBOX_DUALWRITE_DB missing from docs/INBOX_DB.md" && exit 1)

grep -q 'inbox_db_seed.sh' docs/INBOX_DB.md   && echo "✅ inbox_db_seed.sh mentioned"   || (echo "❌ inbox_db_seed.sh missing from docs/INBOX_DB.md" && exit 1)

grep -q 'inbox_store_auto.sh' docs/INBOX_DB.md   && echo "✅ inbox_store_auto.sh mentioned"   || (echo "❌ inbox_store_auto.sh missing from docs/INBOX_DB.md" && exit 1)

grep -q 'restricted: true' docs/INBOX_DB.md   && echo "✅ restricted behavior explained"   || (echo "❌ restricted: true not explained in docs/INBOX_DB.md" && exit 1)

echo ""
echo "-- Contract doc must link to INBOX_DB.md --"
grep -q 'INBOX_DB.md' docs/INBOX_BACKEND_CONTRACT.md   && echo "✅ INBOX_BACKEND_CONTRACT.md links INBOX_DB.md"   || (echo "❌ INBOX_BACKEND_CONTRACT.md does not mention INBOX_DB.md" && exit 1)

echo ""
echo "-- STATE doc must mention sd_125 --"
grep -q 'sd_125' docs/STATE.md   && echo "✅ docs/STATE.md mentions sd_125"   || (echo "❌ docs/STATE.md missing sd_125" && exit 1)

echo ""
echo "✅ sd_125 check passed"
