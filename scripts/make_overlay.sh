#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'TXT'
Make a diff-only overlay zip locally.

Usage:
  ./scripts/make_overlay.sh <zip_name_without_ext> [--summary "..."] [--out <path>] (--changed | --staged | -- <files...>)

Examples:
  # Package current working tree changes (git required):
  ./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" --changed

  # Package only staged changes:
  ./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" --staged

  # Package an explicit list of files (works without git):
  ./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" -- \
    frontend/src/app/siddes-invites/page.tsx \
    frontend/src/components/SidePill.tsx

Notes:
- Output defaults to: ~/Downloads/<zip_name>.zip
- The zip will include a root README_OVERLAY.md with Summary.
- If a path is a directory, it will be copied recursively.
TXT
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 0
fi

ZIP_NAME_RAW="$1"; shift
ZIP_NAME="${ZIP_NAME_RAW%.zip}"
SUMMARY=""
OUT_PATH="${HOME}/Downloads/${ZIP_NAME}.zip"
MODE=""
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary)
      SUMMARY="${2:-}"; shift 2 ;;
    --out)
      OUT_PATH="${2:-}"; shift 2 ;;
    --changed)
      MODE="changed"; shift ;;
    --staged)
      MODE="staged"; shift ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        FILES+=("$1")
        shift
      done
      ;;
    *)
      echo "❌ Unknown arg: $1" >&2
      echo "Run: ./scripts/make_overlay.sh --help" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${MODE}" && ${#FILES[@]} -eq 0 ]]; then
  echo "❌ You must pass --changed, --staged, or an explicit file list after --" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "❌ 'zip' is required but not found on PATH." >&2
  exit 1
fi

collect_files_from_git() {
  if ! command -v git >/dev/null 2>&1; then
    echo "❌ git not found; use explicit file list mode (pass -- <files...>)." >&2
    exit 1
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not inside a git repo; use explicit file list mode (pass -- <files...>)." >&2
    exit 1
  fi

  if [[ "${MODE}" == "staged" ]]; then
    git diff --name-only --cached | sed '/^\s*$/d' | awk '!seen[$0]++'
    return 0
  fi

  # changed = staged + unstaged + untracked
  {
    git diff --name-only
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | sed '/^\s*$/d' | awk '!seen[$0]++'
}

if [[ -n "${MODE}" ]]; then
  FILES=()
  while IFS= read -r line; do
    [[ -n "${line}" ]] && FILES+=("${line}")
  done < <(collect_files_from_git)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "❌ No files collected. Nothing to zip." >&2
  exit 1
fi

TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "${TMPDIR}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# README_OVERLAY.md at root
{
  echo "# ${ZIP_NAME}"
  echo ""
  if [[ -n "${SUMMARY}" ]]; then
    echo "Summary: ${SUMMARY}"
  else
    echo "Summary: (fill me)"
  fi
  echo ""
  echo "## Files"
  for f in "${FILES[@]}"; do
    echo "- ${f}"
  done
} > "${TMPDIR}/README_OVERLAY.md"

# Machine-readable manifest
printf "%s\n" "${FILES[@]}" > "${TMPDIR}/OVERLAY_MANIFEST.txt"

copy_one() {
  local p="$1"

  if [[ ! -e "${p}" ]]; then
    echo "❌ Missing path: ${p}" >&2
    exit 1
  fi

  # Safety: prevent accidental huge overlays (node_modules etc.)
  case "${p}" in
    *node_modules*|*.next*|*__pycache__*)
      echo "❌ Refusing to include build artifacts: ${p}" >&2
      echo "   Tip: overlays must include source only (no .next/node_modules)." >&2
      exit 1
      ;;
  esac

  local dest="${TMPDIR}/${p}"
  mkdir -p "$(dirname "${dest}")"

  if [[ -d "${p}" ]]; then
    cp -R "${p}" "${dest}"
  else
    cp "${p}" "${dest}"
  fi
}

for f in "${FILES[@]}"; do
  copy_one "${f}"
done

mkdir -p "$(dirname "${OUT_PATH}")"

( cd "${TMPDIR}" && zip -r "${OUT_PATH}" . >/dev/null )

echo "✅ Created overlay: ${OUT_PATH}"
echo ""
echo "Apply:"
echo "  chmod +x scripts/apply_overlay.sh"
echo "  ./scripts/apply_overlay.sh ${OUT_PATH}"
echo "  ./verify_overlays.sh"
echo "  ./scripts/run_tests.sh"
