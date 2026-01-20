#!/usr/bin/env bash
set -euo pipefail

# run_sd.sh
# Finds and runs Siddes apply-helper scripts reliably, no matter where they were downloaded.
#
# Examples:
#   ./scripts/run_sd.sh 384
#   ./scripts/run_sd.sh 385
#   ./scripts/run_sd.sh 386
#   ./scripts/run_sd.sh sd_386_broadcast_compose_web_shell_apply_helper.sh
#
# Behavior:
# - Searches repo ./scripts first, then ~/Downloads (and ~/Downloads/sidesroot/scripts if present).
# - If script is found in Downloads, copies it into ./scripts for permanence.
# - Chooses the most recently modified match when duplicates exist (e.g., "(1)" files).
# - chmod +x and runs it.

usage () {
  echo "Usage: ./scripts/run_sd.sh <id-or-filename>"
  echo "Examples:"
  echo "  ./scripts/run_sd.sh 386"
  echo "  ./scripts/run_sd.sh sd_386_broadcast_compose_web_shell_apply_helper.sh"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

ROOT="$(pwd)"
if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]] || [[ ! -d "$ROOT/scripts" ]]; then
  echo "ERROR: Run from repo root (folder containing ./frontend ./backend ./scripts)."
  exit 1
fi

ARG="$1"

if [[ "$ARG" == sd_* ]]; then
  PATTERN="$ARG"
else
  PATTERN="sd_${ARG}_*apply_helper*.sh"
fi

SEARCH_DIRS=(
  "$ROOT/scripts"
  "$HOME/Downloads"
  "$HOME/Downloads/sidesroot/scripts"
)

cands=()

# Find candidates
for dir in "${SEARCH_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r -d '' f; do
    cands+=("$f")
  done < <(find "$dir" -maxdepth 1 -type f -name "$PATTERN" -print0 2>/dev/null || true)
done

if [[ ${#cands[@]} -eq 0 ]]; then
  echo "No matching script found."
  echo "Pattern: $PATTERN"
  echo "Looked in:"
  for d in "${SEARCH_DIRS[@]}"; do
    echo "  - $d"
  done
  echo ""
  echo "Tip: If you downloaded a script, ensure it's in ~/Downloads (default) or copy it to ./scripts."
  exit 1
fi

mtime () {
  # macOS
  if stat -f %m "$1" >/dev/null 2>&1; then
    stat -f %m "$1"
    return
  fi
  # Linux
  if stat -c %Y "$1" >/dev/null 2>&1; then
    stat -c %Y "$1"
    return
  fi
  echo 0
}

best=""
best_m=0
for f in "${cands[@]}"; do
  m="$(mtime "$f")"
  if [[ "$m" -ge "$best_m" ]]; then
    best="$f"
    best_m="$m"
  fi
done

# If found in Downloads, copy into repo scripts
if [[ "$best" == "$HOME/Downloads/"* ]] && [[ "$best" != "$ROOT/scripts/"* ]]; then
  base="$(basename "$best")"
  mkdir -p "$ROOT/scripts"
  cp "$best" "$ROOT/scripts/$base"
  best="$ROOT/scripts/$base"
  echo "Copied into scripts/: $base"
fi

chmod +x "$best" || true
echo "Running: $best"
"$best"
