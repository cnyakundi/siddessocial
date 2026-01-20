#!/usr/bin/env bash
set -u
set -o pipefail

# Full Project Audit — generates an "everything at once" Broken Things Register input.
# Output:
#   audit_runs/audit_YYYYMMDD_HHMMSS/  (logs + summary)
#   audit_runs/audit_YYYYMMDD_HHMMSS.zip
#
# Run from repo root:
#   bash scripts/dev/full_project_audit.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="audit_runs/audit_${TS}"
mkdir -p "$OUT_DIR"

log() { printf "%s\n" "$*" | tee -a "$OUT_DIR/summary.log" >/dev/null; }

run_cmd() {
  local name="$1"; shift
  local logfile="$OUT_DIR/${name}.log"
  log ""
  log "== $name =="
  log "cmd: $*"
  ( "$@" ) >"$logfile" 2>&1
  local code=$?
  echo "$code" >"$OUT_DIR/${name}.exitcode"
  log "exit: $code"
  log "log:  $logfile"
  return 0
}

# Environment snapshot
{
  echo "date: $(date)"
  echo "pwd:  $(pwd)"
  echo ""
  echo "node: $(command -v node || true)"
  echo "npm:  $(command -v npm || true)"
  echo "python: $(command -v python3 || command -v python || true)"
  echo "docker: $(command -v docker || true)"
  echo ""
  node -v 2>/dev/null || true
  npm -v 2>/dev/null || true
  python3 --version 2>/dev/null || true
  docker --version 2>/dev/null || true
} > "$OUT_DIR/env.txt"

log "✅ Wrote: $OUT_DIR/env.txt"

# FRONTEND AUDIT
if [[ -d "frontend" ]]; then
  pushd frontend >/dev/null

  # Lint (warnings + errors)
  run_cmd "frontend_lint" npm run lint || true

  # Typecheck (all TS errors at once)
  # Prefer a script if it exists, else npx tsc.
  if npm run -s | grep -qE '^  typecheck$|^  tsc$'; then
    if npm run -s | grep -q '^  typecheck$'; then
      run_cmd "frontend_typecheck" npm run typecheck || true
    else
      run_cmd "frontend_typecheck" npm run tsc || true
    fi
  else
    run_cmd "frontend_typecheck" npx tsc --noEmit || true
  fi

  # Build gate
  run_cmd "frontend_build" npm run build || true

  popd >/dev/null
else
  log "⚠️ frontend/ missing; skipping frontend audit."
fi

# BACKEND AUDIT (docker)
COMPOSE="ops/docker/docker-compose.dev.yml"
if [[ -f "$COMPOSE" ]]; then
  # ensure containers are reachable, but don't fail the whole audit if docker is stopped
  run_cmd "backend_ps" docker compose -f "$COMPOSE" ps || true
  run_cmd "backend_makemigrations_dryrun" docker compose -f "$COMPOSE" exec -T backend python manage.py makemigrations --dry-run || true
  run_cmd "backend_check" docker compose -f "$COMPOSE" exec -T backend python manage.py check || true
else
  log "⚠️ $COMPOSE not found; skipping backend docker audit."
fi

# Summary markdown
SUMMARY_MD="$OUT_DIR/AUDIT_SUMMARY.md"
{
  echo "# Siddes Full Project Audit"
  echo ""
  echo "- Timestamp: $TS"
  echo "- Root: $(pwd)"
  echo ""
  echo "## Key outputs"
  echo ""
  echo "- env: env.txt"
  echo "- frontend: frontend_lint.log, frontend_typecheck.log, frontend_build.log"
  echo "- backend: backend_makemigrations_dryrun.log (if docker compose present)"
  echo ""
  echo "## Exit codes"
  echo ""
  echo "| Check | Exit | Log |"
  echo "|---|---:|---|"
  for f in "$OUT_DIR"/*.exitcode; do
    name="$(basename "$f" .exitcode)"
    code="$(cat "$f" 2>/dev/null || echo "?")"
    echo "| $name | $code | ${name}.log |"
  done
  echo ""
  echo "## What to do next"
  echo ""
  echo "1) If **frontend_typecheck** or **frontend_build** failed, upload the ZIP to ChatGPT."
  echo "2) We'll generate a single big fix-batch with all errors resolved together."
} > "$SUMMARY_MD"

log "✅ Wrote: $SUMMARY_MD"

# Zip for upload
ZIP_PATH="audit_runs/audit_${TS}.zip"
if command -v zip >/dev/null 2>&1; then
  (cd audit_runs && zip -qr "audit_${TS}.zip" "audit_${TS}") || true
  log "✅ Zipped: $ZIP_PATH"
else
  log "⚠️ zip not found; please upload the folder: $OUT_DIR"
fi

echo ""
echo "=============================="
echo "AUDIT COMPLETE"
echo "Folder: $OUT_DIR"
echo "ZIP:    $ZIP_PATH"
echo ""
echo "Upload the ZIP back here and I'll return a single consolidated Broken-Things Register + big-batch fixes."
echo "=============================="
