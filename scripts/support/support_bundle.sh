#!/usr/bin/env bash
set -euo pipefail

# scripts/support/support_bundle.sh
# Generates a support bundle you can attach to bug reports.
# It tries to be safe: env files are REDACTED for common secret patterns.

TS="$(date +%Y%m%d_%H%M%S)"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/support_bundle_${TS}"
OUT_TGZ="${ROOT}/support_bundle_${TS}.tgz"

redact_env() {
  local infile="$1"
  local outfile="$2"
  if [ ! -f "$infile" ]; then
    return 0
  fi
  cat "$infile" | sed -E     -e 's/^([A-Za-z0-9_]*(SECRET|PASSWORD|PASS|TOKEN|KEY|COOKIE|CSRF|SESSION)[A-Za-z0-9_]*=).*/\1REDACTED/gI'     -e 's/^([A-Za-z0-9_]*DATABASE_URL=).*/\1REDACTED/gI'     > "$outfile"
}

mkdir -p "$OUT_DIR"

{
  echo "Siddes Support Bundle"
  echo "Timestamp: $TS"
  echo "Root: $ROOT"
} > "$OUT_DIR/README.txt"

{
  echo "== System =="
  date || true
  uname -a || true
  echo ""
  echo "== Versions =="
  python3 --version 2>/dev/null || python --version 2>/dev/null || true
  node -v 2>/dev/null || true
  npm -v 2>/dev/null || true
  docker --version 2>/dev/null || true
  docker compose version 2>/dev/null || true
} > "$OUT_DIR/versions.txt"

{
  echo "== Git =="
  git rev-parse --is-inside-work-tree 2>/dev/null || true
  git rev-parse HEAD 2>/dev/null || true
  git status --porcelain 2>/dev/null || true
} > "$OUT_DIR/git.txt"

mkdir -p "$OUT_DIR/env"
redact_env "$ROOT/ops/docker/.env" "$OUT_DIR/env/ops_docker_env.redacted"
redact_env "$ROOT/backend/.env" "$OUT_DIR/env/backend_env.redacted"
redact_env "$ROOT/frontend/.env" "$OUT_DIR/env/frontend_env.redacted"

{
  echo "== docker compose ps (dev) =="
  if docker compose version >/dev/null 2>&1 && [ -f "$ROOT/ops/docker/docker-compose.dev.yml" ]; then
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" ps || true
  else
    echo "docker compose not available or compose file missing"
  fi
} > "$OUT_DIR/docker_ps.txt"

{
  echo "== Django checks =="
  if docker compose version >/dev/null 2>&1 && [ -f "$ROOT/ops/docker/docker-compose.dev.yml" ]; then
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" exec -T backend python manage.py check || true
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" exec -T backend python manage.py showmigrations || true
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" exec -T backend python manage.py launch_check --strict || true
  else
    echo "docker compose not available or compose file missing"
  fi
} > "$OUT_DIR/backend_checks.txt"

{
  echo "== docker logs backend (tail 400) =="
  if docker compose version >/dev/null 2>&1 && [ -f "$ROOT/ops/docker/docker-compose.dev.yml" ]; then
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" logs --tail=400 backend || true
  else
    echo "docker compose not available or compose file missing"
  fi
} > "$OUT_DIR/backend_logs_tail.txt"

{
  echo "== docker logs (all) (tail 200) =="
  if docker compose version >/dev/null 2>&1 && [ -f "$ROOT/ops/docker/docker-compose.dev.yml" ]; then
    docker compose -f "$ROOT/ops/docker/docker-compose.dev.yml" logs --tail=200 || true
  else
    echo "docker compose not available or compose file missing"
  fi
} > "$OUT_DIR/docker_logs_tail.txt"

{
  echo "== HTTP probes (Next -> Django) =="
  curl -sS "http://localhost:3000/api/health" || true
  echo ""
  curl -sS "http://localhost:3000/api/auth/me" || true
} > "$OUT_DIR/http_probes.txt"

{
  echo "== Frontend checks =="
  if [ -d "$ROOT/frontend" ] && [ -f "$ROOT/frontend/package.json" ]; then
    cd "$ROOT/frontend"
    npm run typecheck 2>/dev/null || true
    npm run build 2>/dev/null || true
  else
    echo "frontend folder missing"
  fi
} > "$OUT_DIR/frontend_checks.txt"

tar -czf "$OUT_TGZ" -C "$ROOT" "$(basename "$OUT_DIR")"
echo "✅ Support bundle created:"
echo " - $OUT_TGZ"
