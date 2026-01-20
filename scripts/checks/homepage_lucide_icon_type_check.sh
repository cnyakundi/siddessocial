#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "== Check: Homepage Lucide Icon type accepts string|number (sd_149g) =="

F="frontend/src/app/page.tsx"

# If Home is a simple redirect to the Feed, there's no homepage icon component to validate.
if grep -q 'redirect("/siddes-feed")' "$F"; then
  echo "✅ Home redirects to Feed (no homepage icon types to validate)"
  exit 0
fi

grep -q "size\\?: string \\| number" "$F" || { echo "❌ Homepage Icon type still too narrow"; exit 1; }

echo "✅ Homepage Icon type is correct"
