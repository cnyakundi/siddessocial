#!/usr/bin/env bash
set -euo pipefail

# Deploy Siddes: Vercel (frontend) + DigitalOcean App Platform (backend)

find_repo_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ] && [ -d "$d/ops" ]; then
      echo "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

ROOT="$(find_repo_root)" || {
  echo "ERROR: Run this inside your Siddes repo (must contain frontend/, backend/, ops/)." >&2
  exit 1
}

cd "$ROOT"

echo "== Deploy Siddes (Vercel + DigitalOcean) =="

echo
"$ROOT/scripts/deploy/vercel_setup.sh"

echo
"$ROOT/scripts/deploy/do_upsert.sh"

echo ""
echo "OK: deploy_all complete."
