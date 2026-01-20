#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: No @typescript-eslint/no-unused-vars disables (sd_152c_fix1) =="

if grep -R "@typescript-eslint/no-unused-vars" -n frontend/src >/dev/null 2>&1; then
  echo "❌ Found @typescript-eslint/no-unused-vars reference in frontend/src"
  grep -R "@typescript-eslint/no-unused-vars" -n frontend/src || true
  exit 1
fi

echo "✅ No missing-rule disables found"
