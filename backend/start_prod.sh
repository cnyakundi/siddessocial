#!/usr/bin/env bash
set -euo pipefail

# Production start script for Siddes backend (Django)
# Safe for DO App Platform / Droplet / any container runtime.

PYBIN="python"
if ! command -v python >/dev/null 2>&1; then
  PYBIN="python3"
fi

echo "[start_prod] Running migrations..."
"${PYBIN}" manage.py migrate --noinput

echo "[start_prod] Collecting static..."
"${PYBIN}" manage.py collectstatic --noinput

echo "[start_prod] Starting gunicorn..."
exec gunicorn siddes_backend.wsgi:application -c gunicorn.conf.py
