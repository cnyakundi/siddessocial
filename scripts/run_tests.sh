#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "== Siddes Test Harness =="
echo "Root: ${ROOT}"
echo ""

# 0) Preflight
if [[ -x "./verify_overlays.sh" ]]; then
  ./verify_overlays.sh
fi

# 0.5) Overlay checks (strict)
if [[ -d "scripts/checks" ]]; then
  echo ""
  echo "== Overlay checks =="
  SD_SKIP_CHECKS="${SD_SKIP_CHECKS:-}"
  for chk in scripts/checks/*.sh; do
    [[ -e "$chk" ]] || continue

    base="$(basename "$chk" .sh)"
    if [[ -n "$SD_SKIP_CHECKS" ]]; then
      IFS="," read -r -a __skips <<< "$SD_SKIP_CHECKS"
      for s in "${__skips[@]}"; do
        s="${s//[[:space:]]/}"
        [[ -z "$s" ]] && continue
        if [[ "$base" == "$s" || "${base}.sh" == "$s" ]]; then
          echo "• Skipping check (SD_SKIP_CHECKS): $base"
          continue 2
        fi
      done
    fi
    echo ""
    echo "-> $chk"
    bash "$chk"
  done
fi

warn () { echo "⚠️  $*"; }
info () { echo "• $*"; }

has_node_script () {
  local script="$1"
  node -e "const p=require('./package.json'); process.exit((p.scripts && p.scripts['${script}'])?0:1)" >/dev/null 2>&1
}

run_node_script () {
  local pm="$1"
  local script="$2"
  if has_node_script "${script}"; then
    info "Running frontend: ${pm} run ${script}"
    case "${pm}" in
      pnpm) pnpm run "${script}" ;;
      yarn) yarn run "${script}" ;;
      npm) npm run "${script}" ;;
    esac
  else
    warn "frontend script missing: ${script} (skipping)"
  fi
}

if [[ -d "frontend" && -f "frontend/package.json" ]]; then
  echo ""
  echo "== Frontend checks =="
  cd frontend

  PM="npm"
  if [[ -f "pnpm-lock.yaml" ]]; then PM="pnpm"; fi
  if [[ -f "yarn.lock" ]]; then PM="yarn"; fi

  if [[ ! -d "node_modules" ]]; then
    warn "frontend/node_modules not found. Installing deps (first run only)."
    case "${PM}" in
      pnpm)
        command -v pnpm >/dev/null 2>&1 || (command -v corepack >/dev/null 2>&1 && corepack enable && corepack prepare pnpm@latest --activate)
        pnpm install
        ;;
      yarn)
        command -v yarn >/dev/null 2>&1 || (command -v corepack >/dev/null 2>&1 && corepack enable && corepack prepare yarn@stable --activate)
        yarn install
        ;;
      npm)
        npm ci || npm install
        ;;
    esac
  fi

  run_node_script "${PM}" "lint"
  run_node_script "${PM}" "typecheck"
  run_node_script "${PM}" "test"
  run_node_script "${PM}" "build"

  cd "${ROOT}"
else
  warn "No frontend/ detected (skipping frontend checks)"
fi

if [[ -d "backend" ]]; then
  echo ""
  echo "== Backend checks =="
  PY="${PYTHON:-python3}"

  if command -v "${PY}" >/dev/null 2>&1; then
    "${PY}" -m compileall -q backend

    if [[ -f "backend/manage.py" ]]; then
      # Prefer local Django if it is installed in the active Python.
      if "${PY}" -c "import django" >/dev/null 2>&1; then
        info "Running: manage.py check (local)"
        "${PY}" backend/manage.py check || warn "Django check failed (may require env/db)"
        info "Running: manage.py test (local, best effort)"
        "${PY}" backend/manage.py test || warn "Django tests failed (may require DB/config)"
      else
        info "Django not installed locally — running backend checks via Docker (recommended)"

        if command -v docker >/dev/null 2>&1; then
          COMPOSE=()
          if docker compose version >/dev/null 2>&1; then
            COMPOSE=(docker compose)
          elif command -v docker-compose >/dev/null 2>&1; then
            COMPOSE=(docker-compose)
          fi

          if [[ "${#COMPOSE[@]}" -eq 0 ]]; then
            info "Docker Compose not available; skipping Docker backend checks"
          elif [[ ! -f "ops/docker/docker-compose.dev.yml" ]]; then
            info "ops/docker/docker-compose.dev.yml missing; skipping Docker backend checks"
          else
            # Ensure the docker env file exists for compose.
            if [[ ! -f "ops/docker/.env" && -f "ops/docker/.env.example" ]]; then
              info "Creating ops/docker/.env from .env.example"
              cp ops/docker/.env.example ops/docker/.env || true
            fi

            "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py check \
              || warn "Django check failed in Docker (is Docker Desktop running?)"
            "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py test \
              || warn "Django tests failed in Docker (may require DB/migrations)"
          fi
        else
          info "Docker not found; skipping backend checks (frontend is still fully testable)"
        fi
      fi
    else
      info "backend/manage.py not found (skipping Django checks)"
    fi
  else
    info "python3 not found on PATH (skipping backend checks)"
  fi
else
  info "No backend/ detected (skipping backend checks)"
fi

echo ""
echo "✅ Test harness completed."
