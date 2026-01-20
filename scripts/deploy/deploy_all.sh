#!/usr/bin/env bash
set -euo pipefail

find_repo_root() {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ] && [ -d "$d/ops" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: Run from inside the repo." >&2
  exit 1
fi

cd "$ROOT"

echo "== Deploy Siddes (Vercel + DigitalOcean) =="
echo ""

"$ROOT/scripts/deploy/vercel_setup.sh"

echo ""
"$ROOT/scripts/deploy/do_upsert.sh"

echo ""
echo "Done. If DNS isn't set yet:" 
echo "  - Vercel will show required CNAME for app.siddes.com" 
echo "  - DigitalOcean output shows DefaultIngress for api CNAME" 
echo ""
