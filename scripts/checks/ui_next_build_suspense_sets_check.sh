#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Next build Suspense for useSearchParams (/siddes-circles) =="

f="frontend/src/app/siddes-circles/page.tsx"
[[ -f "${f}" ]] || { echo "❌ Missing ${f}"; exit 1; }

grep -q "Suspense" "${f}" || { echo "❌ /siddes-circles missing Suspense wrapper"; exit 1; }
grep -q "SiddesCirclesPageInner" "${f}" || { echo "❌ /siddes-circles missing SiddesCirclesPageInner wrapper structure"; exit 1; }

echo "✅ Suspense wrapper present for /siddes-circles"
