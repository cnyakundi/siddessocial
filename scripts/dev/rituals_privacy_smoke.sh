#!/usr/bin/env bash
set -euo pipefail

# Rituals privacy smoke (dynamic) — attempts leaks and ensures fail-closed behavior.
# Requires backend running (docker compose dev).
#
# Usage:
#   VIEWER=me VIEWER2=close bash scripts/dev/rituals_privacy_smoke.sh
#
# Optional:
#   BASE=http://localhost:8000 VIEWER=me VIEWER2=close bash scripts/dev/rituals_privacy_smoke.sh

source "$(dirname "$0")/_autoload_docker_env.sh"

BASE="${BASE:-http://localhost:${SIDDES_BACKEND_PORT:-8000}}"
VIEWER="${VIEWER:-me}"
VIEWER2="${VIEWER2:-close}"

now_ms() { python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
}

call_json() {
  local method="$1"
  local url="$2"
  local viewer="$3"
  local body="${4:-}"
  local tmp
  tmp="$(mktemp)"
  local code="000"

  if [[ "$method" == "GET" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -H "x-sd-viewer: ${viewer}" "${url}" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "content-type: application/json" -H "x-sd-viewer: ${viewer}" --data "${body}" "${url}" || true)"
  fi

  echo "$code" >"${tmp}.code"
  cat "$tmp" >"${tmp}.json" || true
  echo "$tmp"
}

expect_http() {
  local tmp="$1"
  local want="$2"
  local got
  got="$(cat "${tmp}.code" 2>/dev/null || echo 000)"
  if [[ "$got" != "$want" ]]; then
    echo "❌ FAIL expected HTTP ${want}, got ${got}"
    echo "---- body ----"
    if [[ "$got" == "500" ]]; then
      echo "Hint: run migrate (backend) then retry:"
      echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
      echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
    fi

    cat "${tmp}.json" || true
    echo "--------------"
    rm -f "${tmp}" "${tmp}.code" "${tmp}.json" || true
    exit 1
  fi
}

expect_http_one_of() {
  local tmp="$1"; shift
  local got
  got="$(cat "${tmp}.code" 2>/dev/null || echo 000)"
  for want in "$@"; do
    if [[ "$got" == "$want" ]]; then
      return 0
    fi
  done
  echo "❌ FAIL expected HTTP one of: $* , got ${got}"
  echo "---- body ----"
    if [[ "$got" == "500" ]]; then
      echo "Hint: run migrate (backend) then retry:"
      echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
      echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
    fi

  cat "${tmp}.json" || true
  echo "--------------"
  rm -f "${tmp}" "${tmp}.code" "${tmp}.json" || true
  exit 1
}

json_get() { cat "${1}.json"; }

echo "== Rituals Privacy Smoke =="
echo "BASE  : ${BASE}"
echo "VIEWER: ${VIEWER}"
echo "VIEWER2: ${VIEWER2}"
echo ""

echo "-> healthz"
curl -sS "${BASE}/healthz" >/dev/null
echo "✅ healthz ok"
echo ""

# 1) Unknown viewer should be restricted on list (no header)
code="$(curl -sS -o /tmp/rituals_no_viewer.json -w "%{http_code}" "${BASE}/api/rituals?side=public" || true)"
if [[ "$code" != "200" ]]; then
  echo "❌ FAIL list without viewer expected 200, got ${code}"
  cat /tmp/rituals_no_viewer.json || true
  exit 1
fi
python3 - <<'PY'
import json
p='/tmp/rituals_no_viewer.json'
d=json.load(open(p))
assert d.get('restricted') is True, d
print('✅ restricted list for unknown viewer')
PY
# 2) Create a Set as VIEWER (no members)
ts="$(now_ms)"
set_payload="$(printf '{"side":"friends","label":"Rituals Smoke %s","members":[]}' "$ts")"

echo "-> POST /api/sets (create private set)"
res="$(call_json POST "${BASE}/api/sets" "${VIEWER}" "${set_payload}")"
expect_http_one_of "$res" "200" "201"

set_id="$(python3 -c 'import json,sys
j=json.load(open(sys.argv[1]))
item=j.get("set") or j.get("item") or j
print((item.get("id") or item.get("setId") or "").strip())
' "${res}.json")"

if [[ -z "$set_id" ]]; then
  echo "❌ Could not extract set id"
  cat "${res}.json" || true
  exit 1
fi

echo "✅ created set: ${set_id}"

# 3) Create a ritual inside that set
rit_payload="$(printf '{"kind":"mood","title":"Vibe Check","prompt":"smoke ritual %s","setId":"%s"}' "$ts" "$set_id")"

echo "-> POST /api/rituals (create set-scoped ritual)"
res2="$(call_json POST "${BASE}/api/rituals" "${VIEWER}" "${rit_payload}")"
expect_http_one_of "$res2" "200" "201"

rit_id="$(python3 -c 'import json,sys
j=json.load(open(sys.argv[1]))
rit=(j.get("ritual") or {})
print((rit.get("id") or "").strip())
' "${res2}.json")"

if [[ -z "$rit_id" ]]; then
  echo "❌ Could not extract ritual id"
  cat "${res2}.json" || true
  exit 1
fi

echo "✅ created ritual: ${rit_id}"

# 4) Owner can read detail

echo "-> GET /api/rituals/<id> as owner"
res3="$(call_json GET "${BASE}/api/rituals/${rit_id}" "${VIEWER}")"
expect_http "$res3" "200"
echo "✅ owner can read ritual"

# 5) Non-member should fail closed (404) on detail

echo "-> GET /api/rituals/<id> as non-member (should 404)"
res4="$(call_json GET "${BASE}/api/rituals/${rit_id}" "${VIEWER2}")"
expect_http "$res4" "404"
echo "✅ non-member cannot read ritual (no existence leak)"

# 6) Non-member list for that set returns restricted:true empty

echo "-> GET /api/rituals?side=friends&setId=<set> as non-member (restricted)"
res5="$(call_json GET "${BASE}/api/rituals?side=friends&setId=${set_id}" "${VIEWER2}")"
expect_http "$res5" "200"
python3 - <<PY
import json
j=json.load(open("${res5}.json"))
assert j.get('restricted') is True, j
assert j.get('items') == [] or j.get('items') is None, j
print('✅ non-member list is restricted + empty')
PY
# 7) Non-member cannot respond (404)

echo "-> POST /api/rituals/<id>/respond as non-member (should 404)"
resp_body='{"text":"leak attempt"}'
res6="$(call_json POST "${BASE}/api/rituals/${rit_id}/respond" "${VIEWER2}" "${resp_body}")"
expect_http "$res6" "404"
echo "✅ non-member cannot respond"

echo ""
echo "✅ Rituals privacy smoke passed."
