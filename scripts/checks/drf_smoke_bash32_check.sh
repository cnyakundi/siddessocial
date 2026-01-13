#!/usr/bin/env bash
set -euo pipefail

echo "== Check: DRF smoke script works on macOS bash 3.2 =="

FILE="scripts/dev/drf_smoke.sh"
if [[ ! -f "${FILE}" ]]; then
  echo "❌ Missing: ${FILE}"
  exit 1
fi

if grep -q "declare -A" "${FILE}"; then
  echo "❌ ${FILE} uses associative arrays (bash 4+). Must be bash 3.2 compatible."
  exit 1
fi


if ! grep -q "^http_code ()" "${FILE}"; then
  echo "❌ ${FILE} is missing http_code() helper (used by pick_backend)."
  exit 1
fi

echo "✅ ${FILE} defines http_code() (macOS-safe)."
echo "✅ ${FILE} does not use associative arrays."
