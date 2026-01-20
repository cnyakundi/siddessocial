#!/usr/bin/env bash
set -euo pipefail

# Vercel deploy setup for Siddes monorepo.
# Runs against frontend/ as the Vercel project root.

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

FRONTEND_DIR="$ROOT/frontend"
PROJECT_NAME="${VERCEL_PROJECT:-siddes-frontend}"

# Domains
APP_DOMAIN="${VERCEL_APP_DOMAIN:-app.siddes.com}"
APEX_DOMAIN="${VERCEL_APEX_DOMAIN:-siddes.com}"
WWW_DOMAIN="${VERCEL_WWW_DOMAIN:-www.siddes.com}"
ADD_APEX="${VERCEL_ADD_APEX:-0}"
ADD_WWW="${VERCEL_ADD_WWW:-1}"

API_BASE="${SD_INTERNAL_API_BASE:-https://api.siddes.com}"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://$APP_DOMAIN}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "ERROR: Vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

echo "== Vercel: link project (frontend/) =="
(
  cd "$FRONTEND_DIR"
  vercel link --yes --project "$PROJECT_NAME"
)

echo "== Vercel: connect Git repo (deploy-on-push) =="
# vercel git connect looks for a .git folder IN the cwd.
# In a monorepo, .git is in repo root, so we create a temporary symlink in frontend/.
TMP_GITLINK=0
if [ ! -e "$FRONTEND_DIR/.git" ] && [ -d "$ROOT/.git" ]; then
  ln -s ../.git "$FRONTEND_DIR/.git"
  TMP_GITLINK=1
fi

set +e
(
  cd "$FRONTEND_DIR"
  vercel git connect --yes
)
RC=$?
set -e

if [ "$TMP_GITLINK" = "1" ]; then
  rm -f "$FRONTEND_DIR/.git"
fi

if [ "$RC" -ne 0 ]; then
  echo "WARN: 'vercel git connect' failed. You can connect Git manually:" >&2
  echo "  Vercel Dashboard -> Project -> Settings -> Git -> Connect Repo" >&2
fi

echo "== Vercel: set production env =="
# vercel env add reads value from stdin
printf "%s" "$API_BASE" | (cd "$FRONTEND_DIR" && vercel env add SD_INTERNAL_API_BASE production --force)
printf "%s" "$SITE_URL" | (cd "$FRONTEND_DIR" && vercel env add NEXT_PUBLIC_SITE_URL production --force)

echo "== Vercel: add domains =="
# Usage: vercel domains add [domain] [project]
set +e
(
  cd "$FRONTEND_DIR"
  vercel domains add "$APP_DOMAIN" "$PROJECT_NAME"
  if [ "$ADD_WWW" = "1" ]; then
    vercel domains add "$WWW_DOMAIN" "$PROJECT_NAME"
  fi
  if [ "$ADD_APEX" = "1" ]; then
    vercel domains add "$APEX_DOMAIN" "$PROJECT_NAME"
  fi
)
set -e

echo "== Vercel: deploy to production (frontend/) =="
(
  cd "$FRONTEND_DIR"
  vercel --prod
)

echo "OK: Vercel deploy complete."
