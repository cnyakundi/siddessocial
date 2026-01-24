#!/usr/bin/env bash
set -euo pipefail

echo "== Check: DRF smoke script present =="

if [[ ! -f "scripts/dev/drf_smoke.sh" ]]; then
  echo "❌ Missing: scripts/dev/drf_smoke.sh"
  exit 1
fi

grep -q "DRF Inbox smoke" scripts/dev/drf_smoke.sh
grep -q "/healthz" scripts/dev/drf_smoke.sh
grep -q "/api/inbox/threads" scripts/dev/drf_smoke.sh
grep -q "x-sd-viewer" scripts/dev/drf_smoke.sh
grep -q "python3" scripts/dev/drf_smoke.sh

echo "✅ scripts/dev/drf_smoke.sh present + looks valid"
