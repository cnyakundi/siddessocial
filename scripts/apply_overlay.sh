#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${1:-}"
if [[ -z "${ZIP_PATH}" ]]; then
  echo "Usage: ./scripts/apply_overlay.sh ~/Downloads/<overlay.zip>"
  exit 1
fi

ZIP_PATH="${ZIP_PATH/#\~/$HOME}"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "❌ Overlay zip not found: ${ZIP_PATH}"
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "❌ 'unzip' is required but not found on PATH."
  exit 1
fi

ROOT="$(pwd)"
ZIP_BASENAME="$(basename "${ZIP_PATH}")"

echo "== Applying overlay =="
echo "Root: ${ROOT}"
echo "Zip:  ${ZIP_BASENAME}"

# Apply overlay into repo root
unzip -o "${ZIP_PATH}" -d "${ROOT}" >/dev/null

# Ensure docs exists
mkdir -p "${ROOT}/docs"

INDEX="${ROOT}/docs/OVERLAYS_INDEX.md"
if [[ ! -f "${INDEX}" ]]; then
  cat > "${INDEX}" <<'MD'
# Siddes — Overlays Index

| Applied (UTC) | Overlay Zip | Summary |
|---|---|---|
MD
fi

# Extract Summary from README_OVERLAY.md (preferred) or fallback to first non-empty line.
SUMMARY=""
TMPDIR="$(mktemp -d)"
if unzip -qq "${ZIP_PATH}" README_OVERLAY.md -d "${TMPDIR}" >/dev/null 2>&1; then
  if [[ -f "${TMPDIR}/README_OVERLAY.md" ]]; then
    SUMMARY="$(grep -E '^Summary:' "${TMPDIR}/README_OVERLAY.md" | head -n 1 | sed 's/^Summary:[[:space:]]*//' | sed 's/|/\\|/g' | cut -c1-140 || true)"
    if [[ -z "${SUMMARY}" ]]; then
      SUMMARY="$(grep -v '^[[:space:]]*$' "${TMPDIR}/README_OVERLAY.md" | grep -v '^#' | head -n 1 | sed 's/|/\\|/g' | cut -c1-140 || true)"
    fi
  fi
fi
rm -rf "${TMPDIR}"

TS="$(date -u +"%Y-%m-%d %H:%M:%S")"

# Append only if this zip isn't already recorded
if ! grep -q "${ZIP_BASENAME}" "${INDEX}" 2>/dev/null; then
  echo "| ${TS} | ${ZIP_BASENAME} | ${SUMMARY} |" >> "${INDEX}"
fi

echo "✅ Applied: ${ZIP_BASENAME}"
echo "✅ Updated: docs/OVERLAYS_INDEX.md"
echo ""
echo "Next:"
echo "  ./verify_overlays.sh"
echo "  ./scripts/run_tests.sh"
