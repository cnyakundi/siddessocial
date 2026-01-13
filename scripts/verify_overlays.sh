#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "== Verifying repo overlay tooling =="
echo "Root: ${ROOT}"
echo ""

missing=0

check_file () {
  local p="$1"
  if [[ -f "${p}" ]]; then
    echo "✅ ${p}"
  else
    echo "❌ Missing: ${p}"
    missing=1
  fi
}

check_exec () {
  local p="$1"

  # Beginner-proof: if the file exists but lost its executable bit (common when zips overwrite),
  # auto-fix it here so the harness stays smooth.
  if [[ -f "${p}" && ! -x "${p}" ]]; then
    chmod +x "${p}" >/dev/null 2>&1 || true
  fi

  if [[ -x "${p}" ]]; then
    echo "✅ Executable: ${p}"
  else
    if [[ -f "${p}" ]]; then
      echo "❌ Not executable: ${p}  (run: chmod +x ${p})"
    else
      echo "❌ Missing: ${p}"
    fi
    missing=1
  fi
}

check_exec "scripts/apply_overlay.sh"
check_exec "scripts/verify_overlays.sh"
check_exec "verify_overlays.sh"
check_exec "scripts/run_tests.sh"
echo ""

check_file "docs/MIGRATION_PACK.md"
check_file "docs/STATE.md"
check_file "docs/PHASES.md"
check_file "docs/OVERLAYS_INDEX.md"
check_file "docs/OVERLAY_WORKFLOW.md"
check_file "docs/TESTING.md"
check_file "docs/README.md"
echo ""

if [[ "${missing}" -eq 0 ]]; then
  echo "✅ All good."
else
  echo ""
  echo "Fix:"
  echo "  - Apply sd_000 docs/tooling overlay(s)"
  exit 1
fi
