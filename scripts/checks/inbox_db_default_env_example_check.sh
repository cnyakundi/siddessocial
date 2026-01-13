#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox env example + auto helper (sd_124) =="

echo ""
REQ=(
  "ops/docker/.env.example"
  "scripts/dev/inbox_store_auto.sh"
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
echo "-- .env.example documents inbox toggles --"
grep -q 'SD_INBOX_STORE' ops/docker/.env.example \
  && echo "✅ SD_INBOX_STORE documented" \
  || (echo "❌ SD_INBOX_STORE missing from .env.example" && exit 1)

grep -q 'SD_INBOX_STORE=auto' ops/docker/.env.example \
  && echo "✅ SD_INBOX_STORE=auto documented" \
  || (echo "❌ SD_INBOX_STORE=auto not documented" && exit 1)

grep -q 'SD_INBOX_DUALWRITE_DB' ops/docker/.env.example \
  && echo "✅ SD_INBOX_DUALWRITE_DB documented" \
  || (echo "❌ SD_INBOX_DUALWRITE_DB missing" && exit 1)

echo ""
echo "-- Helper script is executable + sets SD_INBOX_STORE=auto --"
[[ -x scripts/dev/inbox_store_auto.sh ]] \
  && echo "✅ inbox_store_auto.sh is executable" \
  || (echo "❌ inbox_store_auto.sh is not executable" && exit 1)

grep -q 'SD_INBOX_STORE=auto' scripts/dev/inbox_store_auto.sh \
  && echo "✅ helper sets SD_INBOX_STORE=auto" \
  || (echo "❌ helper does not set SD_INBOX_STORE=auto" && exit 1)

echo ""
echo "-- STATE doc must mention sd_124 + helper --"
grep -q 'sd_124' docs/STATE.md \
  && echo "✅ docs/STATE.md mentions sd_124" \
  || (echo "❌ docs/STATE.md missing sd_124" && exit 1)

grep -q 'inbox_store_auto.sh' docs/STATE.md \
  && echo "✅ docs/STATE.md mentions inbox_store_auto.sh" \
  || (echo "❌ docs/STATE.md missing inbox_store_auto.sh" && exit 1)

echo ""
echo "✅ sd_124 check passed"
