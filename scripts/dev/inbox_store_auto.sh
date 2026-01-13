#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: enable inbox store auto mode =="
echo "Root: ${ROOT}"
echo ""

SEED_DB=0

for arg in "$@"; do
  case "${arg}" in
    --seed-db)
      SEED_DB=1
      ;;
    -h|--help)
      echo "Usage: bash scripts/dev/inbox_store_auto.sh [--seed-db]"
      echo ""
      echo "--seed-db   Run migrations + seed DB inbox rows before switching to auto"
      exit 0
      ;;
    *)
      # ignore unknown args for forward-compat
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not found. Install Docker Desktop, then re-run:"
  echo "  bash scripts/dev/inbox_store_auto.sh --seed-db"
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

if [[ "${SEED_DB}" -eq 1 ]]; then
  echo "• Running migrations + seeding inbox demo rows in Postgres..."
  bash scripts/dev/inbox_db_seed.sh --no-switch
  echo ""
fi

echo "• Setting SD_INBOX_STORE=auto in ops/docker/.env"

python3 - <<'PY'
import re
from pathlib import Path

p = Path('ops/docker/.env')
text = p.read_text() if p.exists() else ''
if text and not text.endswith('\n'):
    text += '\n'

if re.search(r'^SD_INBOX_STORE=', text, flags=re.M):
    text = re.sub(r'^SD_INBOX_STORE=.*$', 'SD_INBOX_STORE=auto', text, flags=re.M)
else:
    text += 'SD_INBOX_STORE=auto\n'

p.write_text(text)
print('✅ ops/docker/.env updated: SD_INBOX_STORE=auto')
PY

echo "• Restarting backend container to pick up env..."
"${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up -d --no-deps backend

echo ""
echo "✅ Done. Inbox store is now in auto mode."
echo "   - If Postgres is reachable + migrated → DB store is used"
echo "   - Otherwise → in-memory store is used"
