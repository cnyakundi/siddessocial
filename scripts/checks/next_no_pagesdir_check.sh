#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "== Check: Next uses App Router only (no pagesDir) (sd_149h) =="

if [[ -d frontend/pages || -d frontend/src/pages ]]; then
  echo "❌ pagesDir exists (frontend/pages or frontend/src/pages). Remove it."
  exit 1
fi

[[ -d frontend/src/app ]] || { echo "❌ Missing frontend/src/app"; exit 1; }

echo "✅ No pagesDir present; App Router only"
