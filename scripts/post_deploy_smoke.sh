#!/usr/bin/env bash
set -euo pipefail

APP_ORIGIN="${APP_ORIGIN:-${1:-}}"
API_ORIGIN="${API_ORIGIN:-${2:-}}"
MEDIA_TEST_URL="${MEDIA_TEST_URL:-${3:-}}"  # optional: a real /m/... url from a posted image

if [ -z "${APP_ORIGIN}" ] || [ -z "${API_ORIGIN}" ]; then
  echo "Usage:"
  echo "  ./scripts/post_deploy_smoke.sh <APP_ORIGIN> <API_ORIGIN> [MEDIA_TEST_URL]"
  echo
  echo "Example:"
  echo "  ./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com"
  echo
  echo "Optional media test:"
  echo "  MEDIA_TEST_URL=\"https://app.yourdomain.com/m/some/key?t=...\" ./scripts/post_deploy_smoke.sh ..."
  exit 2
fi

TMP_DIR="${TMP_DIR:-/tmp/siddes_smoke}"
mkdir -p "${TMP_DIR}"

log() { echo "[smoke] $*"; }

curl_json() {
  local url="$1"
  local outfile="$2"
  local hdrfile="$3"
  local code
  code=$(curl -sS -o "${outfile}" -D "${hdrfile}" -w "%{http_code}" "${url}" || true)
  echo "$code"
}

node_get_json_field() {
  local file="$1"
  local key="$2"
  node -e "const fs=require('fs');let t=fs.readFileSync(process.argv[1],'utf8');let j=null;try{j=JSON.parse(t)}catch(e){process.exit(3)};let k=process.argv[2];let v=(j&&Object.prototype.hasOwnProperty.call(j,k))?j[k]:undefined; if (typeof v==='boolean') {process.stdout.write(v?'true':'false');} else if (v===null||v===undefined){process.stdout.write('');} else {process.stdout.write(String(v));}" "$file" "$key"
}

expect_http_200_json_ok() {
  local name="$1"
  local url="$2"
  local out="${TMP_DIR}/${name}.json"
  local hdr="${TMP_DIR}/${name}.hdr"

  log "GET ${url}"
  local code
  code=$(curl_json "$url" "$out" "$hdr")
  if [ "$code" != "200" ]; then
    echo
    echo "FAIL: ${name} expected HTTP 200, got ${code}"
    echo "URL: ${url}"
    echo "--- body ---"
    sed -n '1,200p' "$out" || true
    echo "--- headers ---"
    sed -n '1,200p' "$hdr" || true
    exit 1
  fi

  local ok
  ok=$(node_get_json_field "$out" "ok" || true)
  if [ "$ok" != "true" ]; then
    echo
    echo "FAIL: ${name} expected JSON ok=true"
    echo "URL: ${url}"
    echo "--- body ---"
    sed -n '1,200p' "$out" || true
    exit 1
  fi

  echo "OK: ${name}"
}

expect_http_200_json_any() {
  local name="$1"
  local url="$2"
  local out="${TMP_DIR}/${name}.json"
  local hdr="${TMP_DIR}/${name}.hdr"

  log "GET ${url}"
  local code
  code=$(curl_json "$url" "$out" "$hdr")
  if [ "$code" != "200" ]; then
    echo
    echo "FAIL: ${name} expected HTTP 200, got ${code}"
    echo "URL: ${url}"
    echo "--- body ---"
    sed -n '1,200p' "$out" || true
    exit 1
  fi

  # Ensure JSON parsable
  node -e "const fs=require('fs');JSON.parse(fs.readFileSync(process.argv[1],'utf8'));" "$out" >/dev/null 2>&1 || {
    echo
    echo "FAIL: ${name} response was not valid JSON"
    echo "URL: ${url}"
    echo "--- body ---"
    sed -n '1,200p' "$out" || true
    exit 1
  }

  echo "OK: ${name}"
}

log "Starting Siddes post-deploy smoke tests"
log "APP_ORIGIN=${APP_ORIGIN}"
log "API_ORIGIN=${API_ORIGIN}"

# Backend liveness/readiness
expect_http_200_json_ok "backend_healthz" "${API_ORIGIN%/}/healthz"
expect_http_200_json_ok "backend_readyz" "${API_ORIGIN%/}/readyz"

# Frontend -> backend connectivity via Next
expect_http_200_json_ok "next_api_health" "${APP_ORIGIN%/}/api/health"

# Auth surface
expect_http_200_json_ok "auth_me" "${APP_ORIGIN%/}/api/auth/me"
expect_http_200_json_ok "auth_csrf" "${APP_ORIGIN%/}/api/auth/csrf"

# Feed (may be restricted when logged out, but must be valid JSON + HTTP 200)
expect_http_200_json_any "feed_public" "${APP_ORIGIN%/}/api/feed?side=public&limit=1"

# Optional: media (only works if you provide a real /m/... URL)
if [ -n "${MEDIA_TEST_URL}" ]; then
  log "Testing media URL (should return 200 or 302)."
  code=$(curl -sS -o /dev/null -w "%{http_code}" -I "${MEDIA_TEST_URL}" || true)
  if [ "$code" != "200" ] && [ "$code" != "302" ]; then
    echo
    echo "WARN: media test got HTTP ${code} (expected 200 or 302)"
    echo "URL: ${MEDIA_TEST_URL}"
  else
    echo "OK: media_test (${code})"
  fi
fi

echo
echo "ALL GREEN: core endpoints are up"
echo "Next manual checks: login, create post, upload image, verify /m loads for allowed viewers"
