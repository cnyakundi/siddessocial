#!/usr/bin/env bash
set -euo pipefail

# Create a small zip bundle of the most relevant UI files (Feed/PostCard/top bars/tokens).
# Run from anywhere inside the repo.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "❌ ripgrep (rg) not found. Install: brew install ripgrep"
  exit 1
fi

OUT="sd_ui_window1_bundle_$(date +%Y%m%d_%H%M%S).zip"
TMP_DIR=".tmp_ui_bundle"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

echo "== UI Window 1 bundle =="
echo "Repo: $ROOT"
echo "Output: $OUT"
echo

# Heuristics: find likely key files by name/content
declare -a CANDIDATES=()

# Common component names we usually care about
for NAME in PostCard SideFeed Feed TopBar AppTopBar DesktopTopBar Composer Compose; do
  while IFS= read -r f; do
    CANDIDATES+=("$f")
  done < <(rg -l --hidden --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/build/**' "$NAME" frontend/src 2>/dev/null || true)
done

# Also include common token/style config files if present
for f in \
  frontend/src/styles/globals.css \
  frontend/src/app/globals.css \
  frontend/tailwind.config.* \
  frontend/postcss.config.* \
  frontend/src/lib/utils.* \
  frontend/src/components/ui/* \
  frontend/src/components/*Button* \
  frontend/src/components/*Chip* \
  frontend/src/components/*Badge* \
  frontend/src/components/*Card* \
  frontend/src/components/*TopBar* \
  frontend/src/components/*Feed* \
  frontend/src/components/*Post* \
; do
  if compgen -G "$f" > /dev/null; then
    for hit in $f; do
      CANDIDATES+=("$hit")
    done
  fi
done

# Deduplicate
mapfile -t UNIQUE < <(printf "%s\n" "${CANDIDATES[@]}" | sed '/^\s*$/d' | sort -u)

if [ "${#UNIQUE[@]}" -eq 0 ]; then
  echo "❌ Couldn't auto-locate frontend/src UI files."
  echo "➡️  Manual fallback: zip PostCard + SideFeed + related files and upload."
  exit 1
fi

echo "Including ${#UNIQUE[@]} files:"
printf " - %s\n" "${UNIQUE[@]}" | sed -n '1,120p'
if [ "${#UNIQUE[@]}" -gt 120 ]; then
  echo " - ... (truncated list)"
fi
echo

# Copy preserving paths
for f in "${UNIQUE[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$TMP_DIR/$(dirname "$f")"
    cp "$f" "$TMP_DIR/$f"
  fi
done

# Zip it
rm -f "$OUT"
(
  cd "$TMP_DIR"
  zip -r "../$OUT" . >/dev/null
)

rm -rf "$TMP_DIR"
echo "✅ Created: $ROOT/$OUT"
echo "Now upload that zip here."
