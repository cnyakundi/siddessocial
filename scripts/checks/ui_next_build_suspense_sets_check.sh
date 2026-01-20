#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Next build Suspense for useSearchParams (/siddes-sets) =="

f="frontend/src/app/siddes-sets/page.tsx"
[[ -f "${f}" ]] || { echo "❌ Missing ${f}"; exit 1; }

grep -q "Suspense" "${f}" || { echo "❌ /siddes-sets missing Suspense wrapper"; exit 1; }
grep -q "SiddesSetsPageInner" "${f}" || { echo "❌ /siddes-sets missing SiddesSetsPageInner wrapper structure"; exit 1; }

echo "✅ Suspense wrapper present for /siddes-sets"
