#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"
echo "== Check: Django tests force DEBUG for x-sd-viewer (sd_148f) =="

need () {
  local f="$1"
  local pat="$2"
  grep -q "$pat" "$f" || { echo "❌ $f missing: $pat"; exit 1; }
}

need "backend/siddes_post/tests.py" "@override_settings(DEBUG=True)"
need "backend/siddes_sets/tests.py" "@override_settings(DEBUG=True)"

echo "✅ Django tests force DEBUG=True"
