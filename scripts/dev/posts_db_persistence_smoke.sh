#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# Auto-load docker env so SIDDES_BACKEND_PORT is available.
if [[ -z "${SIDDES_BACKEND_PORT:-}" ]]; then
  if [[ -f "ops/docker/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source ops/docker/.env || true
    set +a
  elif [[ -f "ops/docker/.env.example" ]]; then
    set -a
    # shellcheck disable=SC1091
    source ops/docker/.env.example || true
    set +a
  fi
fi

# Posts+Replies DB persistence smoke test.
#
# What it proves:
# - Create post + reply via DRF endpoints
# - Restart backend container
# - Verify the same post + reply still exist (DB persistence)
#
# If this fails with 404 after restart, you're still using memory store.
#
# Usage:
#   VIEWER=me BASE="http://localhost:${SIDDES_BACKEND_PORT:-8000}" bash scripts/dev/posts_db_persistence_smoke.sh
#
# Optional:
#   RESTART=0   (skip restart; just create+read)
#   COMPOSE_FILE=ops/docker/docker-compose.dev.yml
#   SERVICE=backend
#   WAIT_SECS=40

BASE="${BASE:-http://localhost:${SIDDES_BACKEND_PORT:-8000}}"
VIEWER="${VIEWER:-me}"
SIDE="${SIDE:-public}"
COMPOSE_FILE="${COMPOSE_FILE:-ops/docker/docker-compose.dev.yml}"
SERVICE="${SERVICE:-backend}"
RESTART="${RESTART:-1}"
WAIT_SECS="${WAIT_SECS:-40}"

REQ_CODE=""
REQ_BODY=""

now_ms() { python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local tmp
  tmp="$(mktemp)"

  if [[ "$method" == "GET" ]]; then
    REQ_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -H "x-sd-viewer: ${VIEWER}" "${url}" || true)"
  else
    REQ_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "content-type: application/json" -H "x-sd-viewer: ${VIEWER}" --data "${body}" "${url}" || true)"
  fi

  REQ_BODY="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
}

fail_with_body() {
  local msg="$1"
  echo "❌ ${msg}"
  echo "HTTP: ${REQ_CODE}"
  echo "---- body ----"
  echo "${REQ_BODY}"
  echo "--------------"
  exit 1
}

wait_for_health() {
  local i=0
  while [[ "$i" -lt "$WAIT_SECS" ]]; do
    if curl -fsS "${BASE}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  return 1
}

echo "== Posts DB Persistence Smoke =="
echo "BASE    : ${BASE}"
echo "VIEWER  : ${VIEWER}"
echo "SIDE    : ${SIDE}"
echo "RESTART : ${RESTART}"
echo ""

echo "-> healthz"
if ! curl -fsS "${BASE}/healthz" >/dev/null; then
  echo "❌ Cannot reach backend healthz at ${BASE}/healthz"
  echo "Tip: start docker stack:"
  echo "  ./scripts/dev/start_full_stack_docker.sh"
  exit 1
fi
echo "✅ healthz ok"
echo ""

ts="$(now_ms)"

post_payload="$(printf '{"side":"%s","text":"%s","client_key":"%s"}' \
  "$SIDE" "persist smoke post ${ts}" "persist_${ts}")"

echo "-> POST /api/post"
request_json POST "${BASE}/api/post" "${post_payload}"
if [[ "$REQ_CODE" != "201" && "$REQ_CODE" != "200" ]]; then
  fail_with_body "Create post failed"
fi

post_id="$(python3 -c 'import sys, json
d=json.load(sys.stdin)
p=d.get("post") or {}
print((p.get("id") or d.get("id") or "").strip())
' <<<"$REQ_BODY")"

if [[ -z "$post_id" ]]; then
  fail_with_body "Could not extract post id"
fi
echo "✅ created post: ${post_id}"
echo ""

reply_payload="$(printf '{"text":"%s","client_key":"%s"}' \
  "persist smoke reply ${ts}" "persist_r_${ts}")"

echo "-> POST /api/post/<id>/reply"
request_json POST "${BASE}/api/post/${post_id}/reply" "${reply_payload}"
if [[ "$REQ_CODE" != "201" && "$REQ_CODE" != "200" ]]; then
  fail_with_body "Create reply failed"
fi

echo "✅ created reply"
echo ""

if [[ "$RESTART" == "1" ]]; then
  echo "-> Restart backend (${SERVICE})"
  docker compose -f "${COMPOSE_FILE}" restart "${SERVICE}" >/dev/null

  echo "-> Wait for healthz..."
  if ! wait_for_health; then
    echo "❌ Backend did not become healthy after restart."
    echo "Try:"
    echo "  docker compose -f ${COMPOSE_FILE} logs -f ${SERVICE}"
    exit 1
  fi
  echo "✅ backend healthy"
  echo ""
fi

echo "-> GET /api/post/<id>"
request_json GET "${BASE}/api/post/${post_id}"
if [[ "$REQ_CODE" != "200" ]]; then
  if [[ "$REQ_CODE" == "404" ]]; then
    echo "❌ Post was NOT found after restart (not persisted)."
    echo ""
    echo "This usually means you're still using the memory store."
    echo "Enable DB mode:"
    echo "  1) bash scripts/dev/django_migrate.sh"
    echo "  2) set SD_POST_STORE=auto (or db) in ops/docker/.env"
    echo "  3) docker compose -f ${COMPOSE_FILE} up -d ${SERVICE}"
    echo "  4) rerun this script"
    exit 1
  fi
  fail_with_body "Get post failed"
fi
echo "✅ post still exists"
echo ""

echo "-> GET /api/post/<id>/replies"
request_json GET "${BASE}/api/post/${post_id}/replies"
if [[ "$REQ_CODE" != "200" ]]; then
  fail_with_body "Get replies failed"
fi

count="$(python3 -c 'import sys, json
d=json.load(sys.stdin)
reps=d.get("replies") or []
print(len(reps))
' <<<"$REQ_BODY")"

if [[ "${count}" -lt 1 ]]; then
  echo "❌ Expected at least 1 reply after restart; got ${count}"
  echo "${REQ_BODY}"
  exit 1
fi

echo "✅ replies still exist (count=${count})"
echo ""
echo "✅ Posts DB persistence smoke passed."
