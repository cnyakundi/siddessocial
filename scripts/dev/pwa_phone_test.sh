#!/usr/bin/env bash
set -euo pipefail

# sd_734_pwa_phone_test
# Run a production Next.js server locally and expose it over HTTPS so you can install the PWA on a real phone.

PORT="${PORT:-3000}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.."; pwd)"
cd "$ROOT"

if [[ ! -d "frontend" ]]; then
  echo "ERROR: frontend/ not found. Run from the repo root."
  echo "Current: $(pwd)"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required."
  exit 1
fi

echo "== Siddes PWA phone test (sd_734) =="
echo ""
echo "1) Building production bundle…"
( cd frontend && npm run build )

echo ""
echo "2) Starting production server on http://localhost:${PORT} …"
( cd frontend && PORT="${PORT}" npm run start ) &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Stopping server…"
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Wait for the server to respond
for i in $(seq 1 80); do
  if curl -fsS "http://localhost:${PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

echo ""
echo "3) Starting HTTPS tunnel (localtunnel)…"
echo "   When it prints a https:// URL, open it on your phone:"
echo "   - iPhone/iPad: Safari → Share → Add to Home Screen"
echo "   - Android: Chrome → Install app"
echo ""
echo "Press Ctrl+C to stop."
echo ""

npx localtunnel --port "${PORT}"
