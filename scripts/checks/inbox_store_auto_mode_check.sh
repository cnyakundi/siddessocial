#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox store auto mode (sd_123) =="

echo ""
REQ=(
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
echo "-- Views: default store remains memory --"
grep -q 'SD_INBOX_STORE", "memory"' backend/siddes_inbox/views.py \
  && echo "✅ SD_INBOX_STORE default is memory" \
  || (echo "❌ SD_INBOX_STORE default is not memory" && exit 1)

echo ""
echo "-- Views: auto mode is recognized --"
grep -q 'USE_AUTO' backend/siddes_inbox/views.py \
  && echo "✅ USE_AUTO present" \
  || (echo "❌ USE_AUTO missing" && exit 1)
grep -q 'auto' backend/siddes_inbox/views.py \
  && echo "✅ auto mode string present" \
  || (echo "❌ auto mode string missing" && exit 1)

echo ""
echo "-- Views: DB readiness check is best-effort --"
grep -q 'def _db_ready' backend/siddes_inbox/views.py \
  && echo "✅ _db_ready helper present" \
  || (echo "❌ _db_ready helper missing" && exit 1)
grep -q 'ensure_connection' backend/siddes_inbox/views.py \
  && echo "✅ ensure_connection used" \
  || (echo "❌ ensure_connection not used" && exit 1)
grep -q 'InboxThread' backend/siddes_inbox/views.py \
  && echo "✅ touches InboxThread model (migration check)" \
  || (echo "❌ does not touch InboxThread" && exit 1)

echo ""
echo "-- Seed must be dev-only (DEBUG) --"
grep -q 'seed_demo' backend/siddes_inbox/views.py \
  && echo "✅ seed_demo still present" \
  || (echo "❌ seed_demo missing" && exit 1)
grep -q 'settings, "DEBUG"' backend/siddes_inbox/views.py \
  && echo "✅ seed guarded by DEBUG" \
  || (echo "❌ seed not guarded by DEBUG" && exit 1)

echo ""
echo "-- STATE doc must mention sd_123 + auto --"
grep -q 'sd_123' docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_123" \
  || (echo "❌ docs/STATE.md missing sd_123" && exit 1)
grep -q 'SD_INBOX_STORE=auto' docs/STATE.md \
  && echo "✅ docs/STATE.md documents SD_INBOX_STORE=auto" \
  || (echo "❌ docs/STATE.md missing SD_INBOX_STORE=auto" && exit 1)

echo ""
echo "✅ sd_123 check passed"
