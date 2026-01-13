#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="${ROOT}/docs/STATE.md"

if [[ ! -f "${STATE}" ]]; then
  echo "❌ Missing: docs/STATE.md"
  exit 1
fi

if grep -q "sd_140b" "${STATE}" >/dev/null 2>&1; then
  echo "✅ docs/STATE.md already mentions sd_140b"
  exit 0
fi

{
  echo ""
  echo "## sd_140b — Sets membership propagation"
  echo ""
  echo "- Auto-refresh Sets list/detail after invite accept (setsSignals)."
  echo ""
} >> "${STATE}"

echo "✅ Patched docs/STATE.md: added sd_140b"
