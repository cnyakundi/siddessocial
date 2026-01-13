#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets backend_stub uses NEXT_PUBLIC_API_BASE (Django) with fallback =="

FILE="frontend/src/lib/setsProviders/backendStub.ts"

if [[ ! -f "${FILE}" ]]; then
  echo "❌ Missing: ${FILE}"
  exit 1
fi

echo "✅ ${FILE}"

grep -q "NEXT_PUBLIC_API_BASE" "${FILE}" && echo "✅ Reads NEXT_PUBLIC_API_BASE" || (echo "❌ Missing NEXT_PUBLIC_API_BASE wiring" && exit 1)
grep -q "fetchWithFallback" "${FILE}" && echo "✅ fetchWithFallback present" || (echo "❌ Missing fetchWithFallback" && exit 1)
grep -q "x-sd-viewer" "${FILE}" && echo "✅ Forwards x-sd-viewer" || (echo "❌ Missing x-sd-viewer header forward" && exit 1)

if grep -q "\?viewer=" "${FILE}"; then
  echo "❌ Forbidden: viewer query param present"
  exit 1
fi

echo "✅ No viewer query params"
