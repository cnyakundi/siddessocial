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

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing '$1'." >&2
    exit 1
  }
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: Run from inside the repo." >&2
  exit 1
fi

need vercel
need git

cd "$ROOT"

PROJECT_NAME="siddes-frontend"
FRONTEND_DIR="$ROOT/frontend"
APP_DOMAIN="app.siddes.com"

# Defaults (can be overridden by ops/deploy/frontend.env.prod.local)
SD_INTERNAL_API_BASE="https://api.siddes.com"
NEXT_PUBLIC_SITE_URL="https://app.siddes.com"

if [ -f "$ROOT/ops/deploy/frontend.env.prod.local" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$ROOT/ops/deploy/frontend.env.prod.local"
  set +a
  SD_INTERNAL_API_BASE="${SD_INTERNAL_API_BASE:-$SD_INTERNAL_API_BASE}"
  NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$NEXT_PUBLIC_SITE_URL}"
fi

echo "== Vercel: link project =="
vercel link --yes --cwd "$FRONTEND_DIR" --project "$PROJECT_NAME" >/dev/null

echo "== Vercel: connect Git repo (enables deploy-on-push) =="
# Requires the local repo to have a Git remote already.
vercel git connect --yes --cwd "$FRONTEND_DIR" || true

echo "== Vercel: set production env =="
printf "%s" "$SD_INTERNAL_API_BASE" | vercel env add SD_INTERNAL_API_BASE production --cwd "$FRONTEND_DIR" --force >/dev/null
printf "%s" "$NEXT_PUBLIC_SITE_URL" | vercel env add NEXT_PUBLIC_SITE_URL production --cwd "$FRONTEND_DIR" --force >/dev/null

echo "== Vercel: add domain =="
vercel domains add "$APP_DOMAIN" "$PROJECT_NAME" --cwd "$FRONTEND_DIR" || true

echo "== Vercel: deploy to production =="
vercel --cwd "$FRONTEND_DIR" --prod
