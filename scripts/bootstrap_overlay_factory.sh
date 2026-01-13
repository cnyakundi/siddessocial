#!/usr/bin/env bash
set -euo pipefail

BASE_TAG="${1:-sd_141c_c}"   # change if needed

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# 1) Ensure git exists
command -v git >/dev/null 2>&1 || { echo "❌ git not found. Install git first."; exit 1; }

# 2) Init repo if needed
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

# 3) Add sane .gitignore entries (append-only)
touch .gitignore
add_ignore () { grep -qxF "$1" .gitignore || echo "$1" >> .gitignore; }

add_ignore "dist/"
add_ignore "patches/"
add_ignore "frontend/node_modules/"
add_ignore "frontend/.next/"
add_ignore "frontend/.turbo/"
add_ignore "backend/__pycache__/"
add_ignore "**/__pycache__/"
add_ignore ".venv/"
add_ignore "venv/"
add_ignore ".DS_Store"
add_ignore "*.pyc"

# 4) First commit if none exists
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git add -A
  git commit -m "baseline: initial snapshot"
fi

# 5) Create baseline tag (if missing)
if git rev-parse "$BASE_TAG" >/dev/null 2>&1; then
  echo "✅ baseline tag already exists: $BASE_TAG"
else
  git tag "$BASE_TAG"
  echo "✅ created baseline tag: $BASE_TAG"
fi

# 6) Ensure dist/ patches/ exist
mkdir -p dist patches

# 7) Install make_overlay_zip.sh if missing
if [ ! -f scripts/make_overlay_zip.sh ]; then
  mkdir -p scripts
  cat > scripts/make_overlay_zip.sh <<'EOF'
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
EOF
fi

chmod +x scripts/bootstrap_overlay_factory.sh scripts/make_overlay_zip.sh || true

echo ""
echo "✅ Overlay factory ready."
echo "Try:"
echo "  ./scripts/make_overlay_zip.sh sd_143 \"Your desc\" v0.9.24 $BASE_TAG"
