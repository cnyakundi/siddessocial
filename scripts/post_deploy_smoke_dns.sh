#!/usr/bin/env bash
set -euo pipefail

APP_ORIGIN="${1:-}"
API_ORIGIN="${2:-}"

if [ -z "${APP_ORIGIN}" ] || [ -z "${API_ORIGIN}" ]; then
  echo "Usage: ./scripts/post_deploy_smoke_dns.sh https://app.siddes.com https://api.siddes.com"
  exit 1
fi

echo "[smoke+] Starting Siddes post-deploy smoke tests (with DNS diagnostics)"
echo "[smoke+] APP_ORIGIN=${APP_ORIGIN}"
echo "[smoke+] API_ORIGIN=${API_ORIGIN}"
echo

BASE_DOMAIN="$(echo "${API_ORIGIN}" | sed -E 's#https?://##' | sed -E 's#^api\.##')"
if [ -n "${BASE_DOMAIN}" ]; then
  echo "[smoke+] Running DNS preflight for ${BASE_DOMAIN}"
  if [ -x "./scripts/dns_and_http_preflight.sh" ]; then
    ./scripts/dns_and_http_preflight.sh "${BASE_DOMAIN}" || true
  else
    echo "Missing ./scripts/dns_and_http_preflight.sh (apply sd_431)."
  fi
  echo
fi

curl -sS -o /dev/null -w "" --max-time 2 "${API_ORIGIN}/healthz" >/dev/null 2>&1 || true

echo "[smoke+] Basic endpoint checks"
set +e
HZ="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${API_ORIGIN}/healthz" 2>/dev/null)"
set -e
HZ="${HZ:-000}"

if [ "${HZ}" = "000" ]; then
  echo "FAIL: backend_healthz expected HTTP 200, got 000"
  echo "Most likely DNS is not set/propagated for API origin."
  echo
  echo "Fix path:"
  echo "  1) DigitalOcean App -> Settings -> Domains -> add the API domain"
  echo "  2) Create the exact DNS record DO provides inside Cloudflare"
  echo "  3) Keep proxy OFF (DNS only) until it works"
  exit 2
fi

if [ "${HZ}" != "200" ]; then
  echo "FAIL: backend_healthz expected HTTP 200, got ${HZ}"
  echo "URL: ${API_ORIGIN}/healthz"
  exit 2
fi

echo "OK: backend_healthz"

APP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${APP_ORIGIN}" 2>/dev/null || true)"
APP_CODE="${APP_CODE:-000}"
echo "APP ${APP_ORIGIN} -> HTTP ${APP_CODE}"

echo "OK: smoke+ partial pass (DNS + healthz)."
echo "Next: run full smoke (if you have it):"
echo "  ./scripts/post_deploy_smoke.sh ${APP_ORIGIN} ${API_ORIGIN}"
