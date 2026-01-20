#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Lucide icon size accepts string|number (sd_152c_fix1) =="

grep -q "size\\?: string \\| number" frontend/src/components/BottomNav.tsx \
  || { echo "❌ BottomNav icon type is still too narrow"; exit 1; }

echo "✅ Lucide icon type OK"
