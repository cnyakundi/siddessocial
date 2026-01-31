#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_832_fix_docker_env_proxy"
TS="$(date +%Y%m%d_%H%M%S)"

find_repo_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" ]] && [[ -d "$d/backend" ]] && [[ -d "$d/scripts" ]]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Run from inside the repo (must contain ./frontend ./backend ./scripts)." >&2
  echo "Tip: cd /Users/cn/Downloads/sidesroot" >&2
  exit 1
fi

cd "$ROOT"

ENV_DIR="ops/docker"
EXAMPLE="${ENV_DIR}/.env.example"
ENV_FILE="${ENV_DIR}/.env"

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/${ENV_DIR}"

if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" "$BK/${ENV_DIR}/.env"
  echo "Backup: $BK/${ENV_DIR}/.env"
else
  if [[ ! -f "$EXAMPLE" ]]; then
    echo "ERROR: Missing $EXAMPLE" >&2
    exit 1
  fi
  cp -a "$EXAMPLE" "$ENV_FILE"
  echo "Created: $ENV_FILE (from .env.example)"
fi

ensure_kv() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -qE "^${key}=" "$file"; then
    # replace in-place (portable: use temp file)
    local tmp="${file}.tmp.${TS}"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} { if ($1==k) { print k"="v } else { print $0 } }' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    echo "" >> "$file"
    echo "${key}=${value}" >> "$file"
  fi
}

# Dev docker defaults (safe)
ensure_kv "SIDDES_FRONTEND_PORT" "3000" "$ENV_FILE"
ensure_kv "SIDDES_BACKEND_PORT" "8000" "$ENV_FILE"

# Browser -> backend (host machine)
# (Even if most calls go through Next /api proxies, this keeps any legacy direct calls sane.)
ensure_kv "NEXT_PUBLIC_API_BASE" "http://localhost:8000" "$ENV_FILE"

# Frontend container -> backend container (critical for Next server-side proxies)
ensure_kv "SD_INTERNAL_API_BASE" "http://backend:8000" "$ENV_FILE"

echo ""
echo "✅ ${SD_ID}: ensured SD_INTERNAL_API_BASE + NEXT_PUBLIC_API_BASE in ${ENV_FILE}"
echo ""
echo "Next:"
echo "  1) Restart docker dev (from repo root):"
echo "     docker compose -f ops/docker/docker-compose.dev.yml up -d --build frontend"
echo ""
echo "  2) Verify proxy health:"
echo "     curl -s http://localhost:3000/api/_diag | head -n 80"
echo ""
echo "Expected:"
echo "  - ok: true"
echo "  - resolved.chosenBase: http://backend:8000 (or your configured origin)"
echo "  - healthz.ok: true"
