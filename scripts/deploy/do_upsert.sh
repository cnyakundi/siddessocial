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

extract_github_repo() {
  local url="$1"
  # git@github.com:owner/repo.git
  if echo "$url" | grep -q '^git@github.com:'; then
    echo "$url" | sed -E 's#^git@github.com:([^/]+/[^/]+)(\.git)?$#\1#'
    return 0
  fi
  # https://github.com/owner/repo.git
  if echo "$url" | grep -q '^https://github.com/'; then
    echo "$url" | sed -E 's#^https://github.com/([^/]+/[^/]+)(\.git)?/?$#\1#'
    return 0
  fi
  # ssh://git@github.com/owner/repo.git
  if echo "$url" | grep -q '^ssh://git@github.com/'; then
    echo "$url" | sed -E 's#^ssh://git@github.com/([^/]+/[^/]+)(\.git)?/?$#\1#'
    return 0
  fi
  echo ""
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: Run from inside the repo." >&2
  exit 1
fi

need doctl
need git

cd "$ROOT"

SPEC_IN="$ROOT/.do/app.yaml"
SPEC_OUT="$ROOT/.do/app.generated.yaml"
SECRETS_FILE="$ROOT/ops/deploy/backend.env.prod.local"

if [ ! -f "$SPEC_IN" ]; then
  echo "ERROR: Missing $SPEC_IN" >&2
  exit 1
fi

if [ ! -f "$SECRETS_FILE" ]; then
  echo "ERROR: Missing $SECRETS_FILE" >&2
  echo "Create it from: ops/deploy/backend.env.prod.local.example" >&2
  exit 1
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "${REMOTE_URL:-}" ]; then
  echo "ERROR: No git remote 'origin' found. Push this repo to GitHub first." >&2
  exit 1
fi

GITHUB_REPO="$(extract_github_repo "$REMOTE_URL")"
if [ -z "${GITHUB_REPO:-}" ]; then
  echo "ERROR: Couldn't parse a GitHub repo from origin URL: $REMOTE_URL" >&2
  echo "Expected github.com remote." >&2
  exit 1
fi

# Load secrets
set -a
# shellcheck disable=SC1090
source "$SECRETS_FILE"
set +a

req() {
  local k="$1"
  local v
  v="${!k:-}"
  if [ -z "${v:-}" ]; then
    echo "ERROR: $k is empty in $SECRETS_FILE" >&2
    exit 1
  fi
}

req DJANGO_SECRET_KEY
req SIDDES_CONTACTS_PEPPER
req SIDDES_R2_ACCESS_KEY_ID
req SIDDES_R2_SECRET_ACCESS_KEY
req SIDDES_MEDIA_TOKEN_SECRET

cp -a "$SPEC_IN" "$SPEC_OUT"

# Substitute placeholders (escape \ / & and delimiter # for sed replacement)
esc_sed_repl() {
  # Escape \ and & (special in sed replacement) and our delimiter (#).
  printf '%s' "$1" | sed -e 's/[\\&]/\\&/g' -e 's/#/\\#/g'
}


GITHUB_REPO_ESC="$(esc_sed_repl "$GITHUB_REPO")"
DJANGO_SECRET_KEY_ESC="$(esc_sed_repl "$DJANGO_SECRET_KEY")"
SIDDES_CONTACTS_PEPPER_ESC="$(esc_sed_repl "$SIDDES_CONTACTS_PEPPER")"
SIDDES_R2_ACCESS_KEY_ID_ESC="$(esc_sed_repl "$SIDDES_R2_ACCESS_KEY_ID")"
SIDDES_R2_SECRET_ACCESS_KEY_ESC="$(esc_sed_repl "$SIDDES_R2_SECRET_ACCESS_KEY")"
SIDDES_MEDIA_TOKEN_SECRET_ESC="$(esc_sed_repl "$SIDDES_MEDIA_TOKEN_SECRET")"

sed -i.bak "s#__GITHUB_REPO__#${GITHUB_REPO_ESC}#g" "$SPEC_OUT"
sed -i.bak "s#__DJANGO_SECRET_KEY__#${DJANGO_SECRET_KEY_ESC}#g" "$SPEC_OUT"
sed -i.bak "s#__SIDDES_CONTACTS_PEPPER__#${SIDDES_CONTACTS_PEPPER_ESC}#g" "$SPEC_OUT"
sed -i.bak "s#__SIDDES_R2_ACCESS_KEY_ID__#${SIDDES_R2_ACCESS_KEY_ID_ESC}#g" "$SPEC_OUT"
sed -i.bak "s#__SIDDES_R2_SECRET_ACCESS_KEY__#${SIDDES_R2_SECRET_ACCESS_KEY_ESC}#g" "$SPEC_OUT"
sed -i.bak "s#__SIDDES_MEDIA_TOKEN_SECRET__#${SIDDES_MEDIA_TOKEN_SECRET_ESC}#g" "$SPEC_OUT"
rm -f "$SPEC_OUT.bak"

echo "== DigitalOcean: create/update App Platform app (upsert) =="
# NOTE: App Platform must have GitHub access granted in the DO dashboard.
# Auth required: doctl auth init

doctl apps create --spec "$SPEC_OUT" --upsert --format ID,DefaultIngress,Created

echo "" 
echo "Next DNS step (Cloudflare):" 
echo "  - Create CNAME api -> <DefaultIngress shown above> (or follow DO domain instructions)" 
echo "Then run: doctl apps create-deployment <APP_ID> (optional)"
