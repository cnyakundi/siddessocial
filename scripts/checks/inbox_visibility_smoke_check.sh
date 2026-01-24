#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox visibility smoke script (bash 3.2 safe) =="

FILE="scripts/dev/inbox_visibility_smoke.sh"
if [[ ! -f "${FILE}" ]]; then
  echo "❌ Missing: ${FILE}"
  exit 1
fi

if grep -q "declare -A" "${FILE}"; then
  echo "❌ ${FILE} uses associative arrays (bash 4+). Must be macOS bash 3.2 compatible."
  exit 1
fi

if ! grep -q "fetch_threads" "${FILE}"; then
  echo "❌ ${FILE} missing expected fetch_threads helper"
  exit 1
fi

echo "✅ ${FILE} exists and is bash-3.2 compatible."
