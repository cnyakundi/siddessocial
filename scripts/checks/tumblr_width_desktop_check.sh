#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Tumblr-width desktop (sd_155) =="

CC="frontend/src/components/ContentColumn.tsx"
DT="frontend/src/components/DesktopTopBar.tsx"

[[ -f "$CC" ]] || { echo "❌ Missing: $CC"; exit 1; }
echo "✅ $CC"

if [[ -f "$DT" ]]; then
  echo "✅ $DT"
  grep -q "max-w-\\[680px\\]" "$DT" || { echo "❌ DesktopTopBar is not constrained to max-w-[680px]"; exit 1; }
  echo "✅ DesktopTopBar constrained to 680px"
else
  echo "ℹ️ DesktopTopBar not found; skipping width assert"
fi

echo "✅ Tumblr-width check OK"
