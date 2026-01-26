#!/usr/bin/env bash
set -euo pipefail

# scripts/debug_pack.sh
# Pasteable "truth pack" for debugging (no secrets by default).
#
# Usage:
#   bash scripts/debug_pack.sh
#   INCLUDE_LOGS=1 bash scripts/debug_pack.sh            # include docker compose logs (tail)
#   CONTEXT="path/to/file.tsx:120" bash scripts/debug_pack.sh  # show source context around a line

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

say() { echo "$*"; }
hr() { echo "------------------------------------------------------------"; }

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

say "Siddes Debug Pack"
say "Timestamp (UTC): ${TS}"
hr

# ---- Baseline (git) ----
say "== Baseline =="
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  say "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
  say "commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")"
  say "last_commit: $(git log -1 --oneline 2>/dev/null || true)"
  say ""
  say "git status -sb:"
  git status -sb 2>/dev/null || true
else
  say "git: not available (or not a git repo)"
fi
hr

# ---- Versions ----
say "== Versions =="
if command -v node >/dev/null 2>&1; then
  say "node: $(node -v 2>/dev/null || true)"
else
  say "node: (not found)"
fi

if command -v python3 >/dev/null 2>&1; then
  say "python3: $(python3 -V 2>&1 || true)"
elif command -v python >/dev/null 2>&1; then
  say "python: $(python -V 2>&1 || true)"
else
  say "python: (not found)"
fi

# Next.js version (from frontend/package.json)
if [[ -f "frontend/package.json" ]] && command -v node >/dev/null 2>&1; then
  nextv="$(node -p "const p=require('./frontend/package.json'); (p.dependencies&&p.dependencies.next)||(p.devDependencies&&p.devDependencies.next)||'unknown'" 2>/dev/null || echo "unknown")"
  say "next: ${nextv}"
else
  say "next: unknown (frontend/package.json missing or node missing)"
fi

# Django version (best effort; requires venv/docker env)
djv="unknown"
if command -v python3 >/dev/null 2>&1; then
  djv="$(python3 - <<'PY' 2>/dev/null || true
try:
  import django
  print(django.get_version())
except Exception:
  pass
PY
)"
fi
if [[ -n "${djv}" ]]; then
  say "django: ${djv}"
else
  say "django: unknown (not importable in current shell)"
fi
hr

# ---- Env keys (no values) ----
say "== Key env vars (keys only; no values) =="
# From current shell env
env | egrep '^(NEXT_PUBLIC_API_BASE|DJANGO_SETTINGS_MODULE|SD_[A-Z0-9_]+)=' | sed 's/=.*$/=/' || true

# From common env files (strip values)
for f in ".env.local" "frontend/.env.local" "backend/.env" "ops/docker/.env" "ops/docker/.env.local"; do
  if [[ -f "${f}" ]]; then
    say ""
    say "from ${f}:"
    egrep '^(NEXT_PUBLIC_API_BASE|DJANGO_SETTINGS_MODULE|SD_[A-Z0-9_]+)=' "${f}" | sed 's/=.*$/=/' || true
  fi
done
hr

# ---- Context around a source line ----
if [[ -n "${CONTEXT:-}" ]]; then
  say "== Source context (${CONTEXT}) =="
  path="${CONTEXT%%:*}"
  line="${CONTEXT##*:}"
  if [[ -f "${path}" ]] && [[ "${line}" =~ ^[0-9]+$ ]]; then
    start=$(( line-15 )); if [[ "${start}" -lt 1 ]]; then start=1; fi
    end=$(( line+15 ))
    nl -ba "${path}" | sed -n "${start},${end}p" || true
  else
    say "WARN: CONTEXT must be 'path:line' and the file must exist."
  fi
  hr
fi

# ---- Optional docker compose snapshot + logs ----
if [[ "${INCLUDE_LOGS:-0}" == "1" ]]; then
  say "== Docker (optional logs) =="
  if command -v docker >/dev/null 2>&1 && [[ -f "ops/docker/docker-compose.dev.yml" ]]; then
    say "docker compose ps:"
    docker compose -f ops/docker/docker-compose.dev.yml ps || true
    say ""
    say "backend logs (tail 200):"
    docker compose -f ops/docker/docker-compose.dev.yml logs --tail=200 backend || true
    say ""
    say "frontend logs (tail 200):"
    docker compose -f ops/docker/docker-compose.dev.yml logs --tail=200 frontend || true
  else
    say "docker / compose file not available."
  fi
  hr
else
  say "== Docker logs skipped =="
  say "Set INCLUDE_LOGS=1 to include docker compose logs (tail)."
  hr
fi

say "End."
