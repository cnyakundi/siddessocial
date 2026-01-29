#!/usr/bin/env bash
set -euo pipefail

cd "$(pwd)"

OUT="sd_ui_window1_bundle_$(date +%Y%m%d_%H%M%S).zip"
rm -f "$OUT"

pick() { find frontend -type f -name "$1" 2>/dev/null | head -n 1; }

POSTCARD="$(pick 'PostCard.tsx')"
SIDEFEED="$(pick 'SideFeed.tsx')"
APPTOPBAR="$(pick 'AppTopBar.tsx')"
DESKTOPTOPBAR="$(pick 'DesktopTopBar.tsx')"
FILTERBAR="$(pick 'SetFilterBar.tsx')"
PICKERSHEET="$(pick 'SetPickerSheet.tsx')"

FILES=()

[ -n "${POSTCARD:-}" ] && FILES+=("$POSTCARD")
[ -n "${SIDEFEED:-}" ] && FILES+=("$SIDEFEED")
[ -n "${APPTOPBAR:-}" ] && FILES+=("$APPTOPBAR")
[ -n "${DESKTOPTOPBAR:-}" ] && FILES+=("$DESKTOPTOPBAR")
[ -n "${FILTERBAR:-}" ] && FILES+=("$FILTERBAR")
[ -n "${PICKERSHEET:-}" ] && FILES+=("$PICKERSHEET")

# Add common styling/config files if they exist
for f in \
  frontend/src/app/globals.css \
  frontend/src/styles/globals.css \
  frontend/tailwind.config.* \
  frontend/postcss.config.* \
  frontend/next.config.* \
  frontend/src/lib/utils.* \
; do
  for hit in $f; do
    [ -f "$hit" ] && FILES+=("$hit")
  done
done

# If we couldn't find the key files, fail with a helpful message
if [ "${#FILES[@]}" -lt 2 ]; then
  echo "❌ Couldn’t find enough UI files automatically."
  echo "Run these and tell me the paths:"
  echo "  find frontend -name 'PostCard.tsx' -o -name 'SideFeed.tsx' | cat"
  exit 1
fi

echo "== Packing UI Window 1 files =="
printf " - %s\n" "${FILES[@]}"

zip -r "$OUT" "${FILES[@]}" >/dev/null
echo
echo "✅ Created: $OUT"
echo "Upload that zip here."
