#!/usr/bin/env bash
set -euo pipefail

OVERLAY_ID="${1:?overlay id e.g. sd_143}"
DESC="${2:?description e.g. Posts+Replies DRF + Next proxy + feed merge}"
VERSION="${3:?version e.g. v0.9.24}"
BASE_REF="${4:-HEAD~1}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

OUT_DIR="$ROOT/dist"
mkdir -p "$OUT_DIR"

SLUG="$(echo "$DESC" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd 'a-z0-9._-')"
ZIP_NAME="${OVERLAY_ID}_${SLUG}_${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

STAGE="$TMP_DIR/stage"
mkdir -p "$STAGE"

mapfile -t NAME_STATUS < <(git diff --name-status --find-renames "$BASE_REF" || true)
mapfile -t UNTRACKED < <(git status --porcelain | awk '/^\?\?/ {print $2}' | grep -E '^(backend|frontend|docs|scripts|docker|compose|.github)/' || true)

DELETES=()

copy_file () {
  local path="$1"
  mkdir -p "$STAGE/$(dirname "$path")"
  cp -p "$path" "$STAGE/$path"
}

for line in "${NAME_STATUS[@]}"; do
  status="$(echo "$line" | awk '{print $1}')"
  case "$status" in
    M|A)
      path="$(echo "$line" | awk '{print $2}')"
      [ -f "$path" ] && copy_file "$path"
      ;;
    R*)
      old="$(echo "$line" | awk '{print $2}')"
      new="$(echo "$line" | awk '{print $3}')"
      [ -f "$new" ] && copy_file "$new"
      DELETES+=("$old")
      ;;
    D)
      path="$(echo "$line" | awk '{print $2}')"
      DELETES+=("$path")
      ;;
  esac
done

for path in "${UNTRACKED[@]}"; do
  [ -f "$path" ] && copy_file "$path"
done

(
  cd "$STAGE"
  zip -r "$ZIP_PATH" . >/dev/null
)

echo "✅ Built: $ZIP_PATH"
echo ""
echo "### Apply (VS Code terminal)"
echo "chmod +x scripts/apply_overlay.sh"
echo "./scripts/apply_overlay.sh ~/Downloads/$ZIP_NAME"
echo "./verify_overlays.sh"
echo "./scripts/run_tests.sh"
echo ""

if [ "${#DELETES[@]}" -gt 0 ]; then
  echo "⚠️ NOTE: deletions/renames detected; overlays can’t auto-delete safely."
  echo "Run after applying:"
  for d in "${DELETES[@]}"; do
    echo "rm -f \"$d\" || true"
  done
  echo ""
fi
