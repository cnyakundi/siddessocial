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
APP_DOMAIN="${APP_DOMAIN:-app.siddes.com}"

# Defaults (can be overridden by ops/deploy/frontend.env.prod.local)
SD_INTERNAL_API_BASE="https://api.siddes.com"
NEXT_PUBLIC_SITE_URL="https://app.siddes.com"

if [ -f "$ROOT/ops/deploy/frontend.env.prod.local" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/ops/deploy/frontend.env.prod.local"
  set +a
  SD_INTERNAL_API_BASE="${SD_INTERNAL_API_BASE:-$SD_INTERNAL_API_BASE}"
  NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$NEXT_PUBLIC_SITE_URL}"
fi

echo "== Vercel: link project (frontend/) =="
vercel link --yes --cwd "$FRONTEND_DIR" --project "$PROJECT_NAME" >/dev/null

# Ensure frontend/.git exists so `vercel git connect` can detect the origin remote.
# (Monorepo: .git is at repo root.)
if [ ! -e "$FRONTEND_DIR/.git" ] && [ -e "$ROOT/.git" ]; then
  ln -s "$ROOT/.git" "$FRONTEND_DIR/.git"
fi

echo "== Vercel: connect Git repo (deploy-on-push) =="
# This may still require a one-time GitHub app permission grant in the Vercel dashboard.
vercel git connect --yes --cwd "$FRONTEND_DIR" || true

echo "== Vercel: set production env =="
printf "%s" "$SD_INTERNAL_API_BASE" | vercel env add SD_INTERNAL_API_BASE production --cwd "$FRONTEND_DIR" --force >/dev/null
printf "%s" "$NEXT_PUBLIC_SITE_URL" | vercel env add NEXT_PUBLIC_SITE_URL production --cwd "$FRONTEND_DIR" --force >/dev/null

echo "== Vercel: add domain (${APP_DOMAIN}) =="
# Correct CLI syntax per Vercel docs: vercel domains add [domain] [project]
# (No --cwd here; domains are attached to the project by name.)
vercel domains add "$APP_DOMAIN" "$PROJECT_NAME" --force || true

echo "== Vercel: deploy to production (frontend/) =="
vercel --cwd "$FRONTEND_DIR" --prod
