#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Migration pack links INBOX_DB quickstart (sd_126) =="

echo ""
REQ=(
  "docs/MIGRATION_PACK.md"
  "docs/INBOX_DB.md"
  "docs/STATE.md"
)

for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ Missing required file: ${f}"
    exit 1
  fi
done

echo ""
echo "-- MIGRATION_PACK must point to INBOX_DB and recommend auto mode --"
grep -q 'INBOX_DB.md' docs/MIGRATION_PACK.md   && echo "✅ MIGRATION_PACK mentions INBOX_DB.md"   || (echo "❌ MIGRATION_PACK.md does not mention INBOX_DB.md" && exit 1)

grep -q 'SD_INBOX_STORE=auto' docs/MIGRATION_PACK.md   && echo "✅ MIGRATION_PACK recommends SD_INBOX_STORE=auto"   || (echo "❌ MIGRATION_PACK.md missing SD_INBOX_STORE=auto recommendation" && exit 1)

grep -q 'inbox_store_auto.sh' docs/MIGRATION_PACK.md   && echo "✅ MIGRATION_PACK mentions inbox_store_auto.sh"   || (echo "❌ MIGRATION_PACK.md missing inbox_store_auto.sh quickstart" && exit 1)

echo ""
echo "-- STATE must mention sd_126 --"
grep -q 'sd_126' docs/STATE.md   && echo "✅ docs/STATE.md mentions sd_126"   || (echo "❌ docs/STATE.md missing sd_126" && exit 1)

echo ""
echo "✅ sd_126 check passed"
