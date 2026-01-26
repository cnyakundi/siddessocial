#!/usr/bin/env bash
set -euo pipefail

YES=0
if [[ "${1:-}" == "--yes" ]]; then
  YES=1
fi

echo "== Siddes declutter (local-only) =="
echo "This script removes common local artifacts. It will NOT touch your code logic."
echo ""
echo "Targets:"
echo " - frontend/.next frontend/.next_build frontend/.turbo"
echo " - Python caches (__pycache__, .pytest_cache, .mypy_cache, .ruff_cache)"
echo " - .backup_* (local apply-helper backups)"
echo " - artifacts/* dist/* (generated outputs)"
echo ""

if [[ "${YES}" -ne 1 ]]; then
  echo "Dry-run mode (no deletion)."
  echo "Run with:  scripts/declutter_repo.sh --yes"
  exit 0
fi

rm -rf frontend/.next frontend/.next_build frontend/.turbo 2>/dev/null || true
find backend -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf .pytest_cache .mypy_cache .ruff_cache 2>/dev/null || true
rm -rf .backup_* 2>/dev/null || true
rm -rf artifacts/* dist/* 2>/dev/null || true

echo "✅ Declutter complete."
