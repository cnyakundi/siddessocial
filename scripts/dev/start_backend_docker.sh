\
    #!/usr/bin/env bash
    set -euo pipefail

    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    cd "${ROOT}"

    echo "== Siddes: start backend (Docker) =="
    echo "Root: ${ROOT}"
    echo ""

    if ! command -v docker >/dev/null 2>&1; then
      echo "❌ Docker not found."
      echo "Install Docker Desktop first, then re-run:"
      echo "  ./scripts/dev/start_backend_docker.sh"
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

    port_in_use () {
      local port="$1"
      if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
        return $?
      fi

      if command -v python3 >/dev/null 2>&1; then
        python3 - "${port}" <<PYPORT >/dev/null 2>&1
    import socket, sys
    p=int(sys.argv[1])
    s=socket.socket()
    try:
        s.bind(("127.0.0.1", p))
    except OSError:
        sys.exit(0)  # in use
    finally:
        try: s.close()
        except: pass
    sys.exit(1)  # free
    PYPORT
        return $?
      fi

      return 1
    }

    choose_free_port () {
      local start="$1"
      local end="$2"
      local p
      for ((p=start; p<=end; p++)); do
        if ! port_in_use "${p}"; then
          echo "${p}"
          return 0
        fi
      done
      return 1
    }

    # Ensure env file exists (compose env_file requires it)
    if [[ ! -f "ops/docker/.env" ]]; then
      if [[ -f "ops/docker/.env.example" ]]; then
        echo "• Creating ops/docker/.env from .env.example"
        cp ops/docker/.env.example ops/docker/.env
      else
        echo "• Creating minimal ops/docker/.env"
        mkdir -p ops/docker
        cat > ops/docker/.env <<EOF
    DJANGO_DEBUG=1
    EOF
      fi
    fi

    DEFAULT_BACKEND_PORT="${SIDDES_BACKEND_PORT:-8000}"
    BACKEND_PORT="$(choose_free_port "${DEFAULT_BACKEND_PORT}" 8010 || true)"

    if [[ -z "${BACKEND_PORT}" ]]; then
      echo "❌ Could not find a free backend port in range ${DEFAULT_BACKEND_PORT}-8010"
      exit 1
    fi

    export SIDDES_BACKEND_PORT="${BACKEND_PORT}"
    export NEXT_PUBLIC_API_BASE="http://127.0.0.1:${SIDDES_BACKEND_PORT}"

    persist_kv () {
      python3 - <<'PY2'
    import os, re
    from pathlib import Path

    file = Path(os.environ.get('SD340_FILE','').strip())
    key  = os.environ.get('SD340_KEY','').strip()
    val  = os.environ.get('SD340_VAL','').strip()

    if not str(file):
        raise SystemExit('persist_kv: SD340_FILE missing')
    if not key:
        raise SystemExit('persist_kv: SD340_KEY missing')

    text = file.read_text(encoding='utf-8') if file.exists() else ''
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    line = f"{key}={val}"

    if pat.search(text):
        text = pat.sub(line, text)
    else:
        if text and not text.endswith('\\n'):
            text += '\\n'
        text += line + '\\n'

    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(text, encoding='utf-8')
    PY2
    }

    # Persist chosen backend port for later shells (optional but helpful)
    SD340_FILE="ops/docker/.env" SD340_KEY="SIDDES_BACKEND_PORT" SD340_VAL="${SIDDES_BACKEND_PORT}" persist_kv
    SD340_FILE="ops/docker/.env" SD340_KEY="NEXT_PUBLIC_API_BASE" SD340_VAL="http://localhost:${SIDDES_BACKEND_PORT}" persist_kv

    SD_ENV_LOCAL="frontend/.env.local"
    SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SD_INTERNAL_API_BASE" SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
    SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="NEXT_PUBLIC_API_BASE" SD340_VAL="http://127.0.0.1:${SIDDES_BACKEND_PORT}" persist_kv
    SD340_FILE="${SD_ENV_LOCAL}" SD340_KEY="SIDDES_BACKEND_PORT" SD340_VAL="${SIDDES_BACKEND_PORT}" persist_kv

    echo "• Backend port: ${SIDDES_BACKEND_PORT}"
    echo ""

    echo "• Starting services (db, redis, backend) in the background..."
    "${COMPOSE[@]}" -f ops/docker/docker-compose.dev.yml up --build -d db redis backend

    echo ""
    echo "Backend health:"
    echo "  http://localhost:${SIDDES_BACKEND_PORT}/healthz"
    echo ""
    echo "Tip:"
    echo "  View logs: ${COMPOSE[*]} -f ops/docker/docker-compose.dev.yml logs -f backend"
