#!/usr/bin/env bash
set -euo pipefail

# Generates strong secrets for production.
# Safe to run multiple times (each run outputs new values).

have() { command -v "$1" >/dev/null 2>&1; }

rand_hex() {
  local nbytes="$1"
  if have openssl; then
    openssl rand -hex "$nbytes"
  else
    # macOS should have openssl; but fallback to node if needed
    node -e "const crypto=require('crypto');process.stdout.write(crypto.randomBytes(${nbytes}).toString('hex'))"
  fi
}

DJANGO_SECRET_KEY="$(rand_hex 32)"
CONTACTS_PEPPER="$(rand_hex 32)"
MEDIA_TOKEN_SECRET="$(rand_hex 32)"

cat <<OUT

=== Siddes Production Secrets ===

DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
SIDDES_CONTACTS_PEPPER=${CONTACTS_PEPPER}
SIDDES_MEDIA_TOKEN_SECRET=${MEDIA_TOKEN_SECRET}

Notes:
- Use the SAME SIDDES_MEDIA_TOKEN_SECRET value as the Cloudflare Worker secret MEDIA_TOKEN_SECRET.
- Do not commit these to git.

OUT
