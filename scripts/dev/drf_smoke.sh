#!/usr/bin/env bash
set -euo pipefail

# Siddes — DRF Inbox smoke
# Goal: fail fast (seconds), not minutes.

say () { echo "$*"; }
fail () { echo "❌ $*"; exit 1; }


http_code () {
  local url="$1"
  local out="$2"
  curl -sS -L --max-time 3 -o "${out}" -w "%{http_code}" "${url}" 2>/dev/null || echo "000"
}

strip_trailing_slash () {
  local s="$1"
  s="${s%/}"
  echo "$s"
}

# Build a list of likely backend bases (prefer explicit env vars).
declare -a CANDIDATES=()

if [[ -n "${SIDDES_API_BASE:-}" ]]; then
  CANDIDATES+=("$(strip_trailing_slash "${SIDDES_API_BASE}")")
fi

if [[ -n "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  CANDIDATES+=("$(strip_trailing_slash "${NEXT_PUBLIC_API_BASE}")")
fi

for p in 8000 8001 8002 8003 8080 8008; do
  CANDIDATES+=("http://localhost:${p}")
done

# De-dupe candidates (bash 3.2 compatible — no associative arrays).
UNIQUE=()
for c in "${CANDIDATES[@]}"; do
  [[ -z "${c}" ]] && continue
  found=0
  for u in "${UNIQUE[@]}"; do
    if [[ "${u}" == "${c}" ]]; then
      found=1
      break
    fi
  done
  if [[ "${found}" -eq 0 ]]; then
    UNIQUE+=("${c}")
  fi
done

pick_backend () {
  local tmp
  tmp="$(mktemp)"
  for base in "${UNIQUE[@]}"; do
    local code
    code="$(http_code "${base}/healthz" "${tmp}")"
    if [[ "${code}" == "200" ]]; then
      rm -f "${tmp}"
      echo "${base}"
      return 0
    fi
  done
  rm -f "${tmp}"
  echo ""
  return 1
}

API_BASE="$(pick_backend || true)"
if [[ -z "${API_BASE}" ]]; then
  fail "Could not reach backend /healthz on localhost. Start it first: ./scripts/dev/start_full_stack_docker.sh"
fi

VIEWER="${VIEWER:-me}"
SIDE="${SIDE:-friends}"
SIDE="$(echo "${SIDE}" | tr '[:upper:]' '[:lower:]')"
LIMIT="${LIMIT:-5}"

say "✅ Backend detected: ${API_BASE}"
say "• Using VIEWER=${VIEWER} SIDE=${SIDE} LIMIT=${LIMIT}"

fetch_json_any () {
  local url1="$1"
  local url2="$2"
  local tmp
  tmp="$(mktemp)"

  local code
  code="$(curl -sS -L --max-time 5 -H "x-sd-viewer: ${VIEWER}" -o "${tmp}" -w "%{http_code}" "${url1}" 2>/dev/null || true)"
  if [[ "${code}" == "200" ]]; then
    cat "${tmp}"
    rm -f "${tmp}"
    return 0
  fi

  code="$(curl -sS -L --max-time 5 -H "x-sd-viewer: ${VIEWER}" -o "${tmp}" -w "%{http_code}" "${url2}" 2>/dev/null || true)"
  if [[ "${code}" == "200" ]]; then
    cat "${tmp}"
    rm -f "${tmp}"
    return 0
  fi

  say "⚠️  Tried:"
  say "  - ${url1} -> ${code}"
  say "  - ${url2} -> ${code}"
  say "Body (first 400 chars):"
  head -c 400 "${tmp}" 2>/dev/null || true
  echo ""
  rm -f "${tmp}"
  return 1
}

THREADS_JSON="$(fetch_json_any \
  "${API_BASE}/api/inbox/threads?side=${SIDE}&limit=${LIMIT}" \
  "${API_BASE}/api/inbox/threads/?side=${SIDE}&limit=${LIMIT}" \
)" || fail "Failed to fetch inbox threads (check backend logs)."

THREAD_ID="$(python3 - <<'PY' "${THREADS_JSON}"
import json, sys
raw = sys.argv[1]
try:
    data = json.loads(raw)
except Exception:
    print("")
    sys.exit(0)

# Contract-first
items = data.get("items")
# Compatibility fallbacks
if items is None:
    items = data.get("results")
if items is None:
    items = data.get("threads")

if not isinstance(items, list) or not items:
    print("")
    sys.exit(0)

t0 = items[0]
print(t0.get("id", "") if isinstance(t0, dict) else "")
PY
)"

if [[ -z "${THREAD_ID}" ]]; then
  say "⚠️  No threads returned. This usually means the viewer is restricted or the side filter has no threads."
  say "Try: VIEWER=me SIDE=public bash scripts/dev/drf_smoke.sh"
  say ""
  say "First 400 chars of response:"
  echo "${THREADS_JSON}" | head -c 400; echo ""
  exit 1
fi

say "✅ Got thread id: ${THREAD_ID}"

THREAD_JSON="$(fetch_json_any \
  "${API_BASE}/api/inbox/thread/${THREAD_ID}?limit=5" \
  "${API_BASE}/api/inbox/thread/${THREAD_ID}/?limit=5" \
)" || fail "Failed to fetch thread payload (check backend logs)."

python3 - <<'PY' "${THREAD_JSON}"
import json, sys

data = json.loads(sys.argv[1])
if not isinstance(data, dict):
    raise SystemExit("payload is not an object")

if data.get("ok") is not True:
    raise SystemExit("ok is not true")

if data.get("restricted") is True:
    raise SystemExit("restricted=true (viewer blocked)")

if not data.get("thread"):
    raise SystemExit("missing thread")

print("✅ Thread payload shape looks OK")
PY

# Optional: send a message (default on). You can disable with SMOKE_SEND=0.
if [[ "${SMOKE_SEND:-1}" != "0" ]]; then
  say "• Sending message (SMOKE_SEND=1)…"
  SEND_JSON="$(curl -sS -L --max-time 5 \
    -H "content-type: application/json" \
    -H "x-sd-viewer: ${VIEWER}" \
    -X POST \
    -d '{"text":"smoke: hello"}' \
    "${API_BASE}/api/inbox/thread/${THREAD_ID}" 2>/dev/null || true)"

  python3 - <<'PY' "${SEND_JSON}"
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception:
    raise SystemExit("sendMessage did not return JSON")

if not isinstance(data, dict) or data.get("ok") is not True:
    raise SystemExit("sendMessage: ok not true")

if data.get("restricted") is True:
    raise SystemExit("sendMessage: restricted=true")

msg = data.get("message")
if not isinstance(msg, dict) or not msg.get("id"):
    raise SystemExit("sendMessage: missing message.id")

print("✅ sendMessage looks OK")
PY
fi

say ""
say "✅ DRF Inbox smoke passed."
