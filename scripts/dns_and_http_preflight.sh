#!/usr/bin/env bash
set -euo pipefail

BASE_DOMAIN="${1:-siddes.com}"
APP_HOST="app.${BASE_DOMAIN}"
API_HOST="api.${BASE_DOMAIN}"

APP_ORIGIN="https://${APP_HOST}"
API_ORIGIN="https://${API_HOST}"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

dig_any() {
  local name="$1"
  local type="${2:-A}"
  if have_cmd dig; then
    dig +short "${name}" "${type}" 2>/dev/null | sed '/^$/d' || true
  elif have_cmd nslookup; then
    nslookup "${name}" 2>/dev/null | sed -n 's/^Address: //p' || true
  else
    echo ""
  fi
}

curl_code() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${url}" 2>/dev/null || true)"
  echo "${code:-000}"
}

echo "== Siddes DNS + HTTP Preflight =="
echo "BASE_DOMAIN=${BASE_DOMAIN}"
echo "APP_HOST=${APP_HOST}"
echo "API_HOST=${API_HOST}"
echo

echo "[1/3] DNS checks"
echo "  app CNAME:"
APP_CNAME="$(dig_any "${APP_HOST}" CNAME | head -n 1 || true)"
if [ -n "${APP_CNAME}" ]; then
  echo "    ${APP_CNAME}"
else
  echo "    (no CNAME answer)"
fi

echo "  app A/AAAA:"
APP_A="$(dig_any "${APP_HOST}" A | head -n 3 || true)"
APP_AAAA="$(dig_any "${APP_HOST}" AAAA | head -n 3 || true)"
if [ -n "${APP_A}" ]; then echo "    A: ${APP_A}"; else echo "    A: (none)"; fi
if [ -n "${APP_AAAA}" ]; then echo "    AAAA: ${APP_AAAA}"; else echo "    AAAA: (none)"; fi

echo "  api CNAME:"
API_CNAME="$(dig_any "${API_HOST}" CNAME | head -n 1 || true)"
if [ -n "${API_CNAME}" ]; then
  echo "    ${API_CNAME}"
else
  echo "    (no CNAME answer)"
fi

echo "  api A/AAAA:"
API_A="$(dig_any "${API_HOST}" A | head -n 3 || true)"
API_AAAA="$(dig_any "${API_HOST}" AAAA | head -n 3 || true)"
if [ -n "${API_A}" ]; then echo "    A: ${API_A}"; else echo "    A: (none)"; fi
if [ -n "${API_AAAA}" ]; then echo "    AAAA: ${API_AAAA}"; else echo "    AAAA: (none)"; fi

echo
echo "[2/3] HTTP checks"
APP_CODE="$(curl_code "${APP_ORIGIN}")"
API_HZ_CODE="$(curl_code "${API_ORIGIN}/healthz")"
API_RD_CODE="$(curl_code "${API_ORIGIN}/readyz")"

echo "  GET ${APP_ORIGIN} -> HTTP ${APP_CODE}"
echo "  GET ${API_ORIGIN}/healthz -> HTTP ${API_HZ_CODE}"
echo "  GET ${API_ORIGIN}/readyz -> HTTP ${API_RD_CODE}"

echo
echo "[3/3] Verdict + next action"

# App guidance
if [ -z "${APP_CNAME}" ]; then
  echo "APP: FAIL (no DNS CNAME)"
  echo "  Cloudflare DNS: create CNAME app -> cname.vercel-dns.com (DNS only to start)."
else
  if echo "${APP_CNAME}" | grep -qi "vercel-dns.com"; then
    echo "APP: DNS looks OK (Vercel)."
  else
    echo "APP: WARNING (CNAME is not Vercel)."
    echo "  Expected target: cname.vercel-dns.com (or what Vercel shows in Domains)."
  fi
fi

# API guidance
if [ -z "${API_CNAME}" ] && [ -z "${API_A}" ] && [ -z "${API_AAAA}" ]; then
  echo "API: FAIL (no DNS record)"
  echo "  Fix: Go to DigitalOcean App -> Settings -> Domains -> add api.${BASE_DOMAIN}."
  echo "  DigitalOcean will show the exact DNS record to create in Cloudflare (usually a CNAME)."
else
  echo "API: DNS record exists."
fi

# If curl returns 000, often DNS fail or TLS handshake
if [ "${API_HZ_CODE}" = "000" ]; then
  echo "API: HTTP FAIL (000). Common causes:"
  echo "  - DNS not propagated / wrong record"
  echo "  - API domain not added/verified in DigitalOcean"
  echo "  - Cloudflare proxy enabled too early (try DNS-only first)"
  echo "  - TLS not issued yet (give it a few minutes after verification)"
fi

if [ "${API_HZ_CODE}" = "200" ] && [ "${API_RD_CODE}" = "200" ]; then
  echo "API: HTTP OK."
fi

echo
echo "Tip:"
echo "  After DNS changes, wait for propagation, then re-run:"
echo "    ./scripts/dns_and_http_preflight.sh ${BASE_DOMAIN}"
