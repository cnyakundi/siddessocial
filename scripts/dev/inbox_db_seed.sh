#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: seed inbox demo data (DB) =="
echo "Root: ${ROOT}"
echo ""

SWITCH=0
RESET=1

for arg in "$@"; do
  case "${arg}" in
    --switch)
      SWITCH=1
      ;;
    --no-switch)
      SWITCH=0
      ;;
    --no-reset)
      RESET=0
      ;;
    --reset)
      RESET=1
      ;;
    -h|--help)
      echo "Usage: bash scripts/dev/inbox_db_seed.sh [--switch] [--no-reset]"
      echo ""
      echo "--switch     Set SD_INBOX_STORE=db in ops/docker/.env and restart backend"
      echo "--no-reset   Do not wipe existing inbox rows before seeding"
      exit 0
      ;;
    *)
      # ignore unknown args for forward-compat
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop, then re-run:"
  echo "  bash scripts/dev/inbox_db_seed.sh --switch"
  exit 1
fi

COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "❌ Docker Compose not available."
  exit 1
fi

# Ensure env file exists (safe, non-destructive)
if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
  echo "• Creating ops/docker/.env from .env.example"
  cp ops/docker/.env.example ops/docker/.env
fi

# Ensure db + migrations
bash scripts/dev/django_migrate.sh

echo ""
echo "• Seeding inbox demo rows..."
SEED_ARGS=()
if [[ "${RESET}" -eq 1 ]]; then
  SEED_ARGS+=(--reset)
fi

"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py seed_inbox_demo "${SEED_ARGS[@]}"

echo ""
if [[ "${SWITCH}" -eq 1 ]]; then
  echo "• Switching SD_INBOX_STORE=db in ops/docker/.env"

  python3 - <<'PY'
import re
from pathlib import Path
p = Path('ops/docker/.env')
text = p.read_text() if p.exists() else ''
if text and not text.endswith('\n'):
    text += '\n'
if re.search(r'^SD_INBOX_STORE=', text, flags=re.M):
    text = re.sub(r'^SD_INBOX_STORE=.*$', 'SD_INBOX_STORE=db', text, flags=re.M)
else:
    text += 'SD_INBOX_STORE=db\n'
p.write_text(text)
print('✅ ops/docker/.env updated: SD_INBOX_STORE=db')
PY

  echo "• Restarting backend container to pick up env..."
  "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up -d --no-deps backend

  echo ""
  echo "✅ Done. Your Django Inbox API will now read from Postgres."
  echo "   (You can flip back with SD_INBOX_STORE=memory)"
else
  echo "✅ Done. Seeded demo rows into Postgres."
  echo "   To use them: set SD_INBOX_STORE=db in ops/docker/.env and restart backend."
fi
