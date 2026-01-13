#!/usr/bin/env bash
set -euo pipefail

# Posts+Replies DRF smoke test (fast).
#
# Usage:
#   VIEWER=me BASE=http://localhost:8000 bash scripts/dev/posts_drf_smoke.sh
#
# Notes:
# - Assumes Docker backend is running and exposed on BASE (default http://localhost:8000).
# - Uses header x-sd-viewer to simulate auth in dev.
# - Fails fast with useful output.

BASE="${BASE:-http://localhost:8000}"
VIEWER="${VIEWER:-me}"
SIDE="${SIDE:-public}"

now_ms() { python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
}

call_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local tmp
  tmp="$(mktemp)"
  local code="000"

  if [[ "$method" == "GET" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -H "x-sd-viewer: ${VIEWER}" "${url}" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "content-type: application/json" -H "x-sd-viewer: ${VIEWER}" --data "${body}" "${url}" || true)"
  fi

  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "❌ FAIL ${method} ${url} -> HTTP ${code}"
    echo "---- body ----"
    cat "$tmp" || true
    echo "--------------"
    rm -f "$tmp"
    exit 1
  fi

  cat "$tmp"
  rm -f "$tmp"
}

echo "== Posts DRF Smoke =="
echo "BASE  : ${BASE}"
echo "VIEWER: ${VIEWER}"
echo "SIDE  : ${SIDE}"
echo ""

echo "-> healthz"
curl -sS "${BASE}/healthz" >/dev/null
echo "✅ healthz ok"
echo ""

ts="$(now_ms)"
post_payload="$(python3 - <<PY
import json
print(json.dumps({
  "side": "${SIDE}",
  "text": f"smoke post {ts}",
  "client_key": f"smoke_{ts}",
}))
PY
)"

echo "-> POST /api/post"
create="$(call_json POST "${BASE}/api/post" "${post_payload}")"
post_id="$(python3 - <<'PY' <<<"$create"
import sys, json
d=json.load(sys.stdin)
p=d.get("post") or {}
pid=p.get("id") or d.get("id") or ""
print(pid)
PY
)"
if [[ -z "$post_id" ]]; then
  echo "❌ Could not extract post id from response:"
  echo "$create"
  exit 1
fi
echo "✅ created post: ${post_id}"
echo ""

echo "-> GET /api/post/<id>"
_="$(call_json GET "${BASE}/api/post/${post_id}")"
echo "✅ get post ok"
echo ""

reply_payload="$(python3 - <<PY
import json
print(json.dumps({
  "text": f"smoke reply {ts}",
  "client_key": f"smoke_r_{ts}",
}))
PY
)"

echo "-> POST /api/post/<id>/reply"
reply_create="$(call_json POST "${BASE}/api/post/${post_id}/reply" "${reply_payload}")"
reply_id="$(python3 - <<'PY' <<<"$reply_create"
import sys, json
d=json.load(sys.stdin)
r=d.get("reply") or {}
rid=r.get("id") or d.get("id") or ""
print(rid)
PY
)"
if [[ -z "$reply_id" ]]; then
  echo "❌ Could not extract reply id from response:"
  echo "$reply_create"
  exit 1
fi
echo "✅ created reply: ${reply_id}"
echo ""

echo "-> GET /api/post/<id>/replies"
replies="$(call_json GET "${BASE}/api/post/${post_id}/replies")"
count="$(python3 - <<'PY' <<<"$replies"
import sys, json
d=json.load(sys.stdin)
reps=d.get("replies") or []
print(len(reps))
PY
)"
if [[ "${count}" -lt 1 ]]; then
  echo "❌ Expected at least 1 reply; got ${count}"
  echo "$replies"
  exit 1
fi
echo "✅ replies list ok (count=${count})"
echo ""
echo "✅ Posts DRF smoke passed."
