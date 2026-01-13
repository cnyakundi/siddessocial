#!/usr/bin/env bash
set -euo pipefail

# Siddes — Inbox visibility smoke (DRF)
# Goal: prove Close/Work never leak (seconds, not minutes).

say () { echo "$*"; }
fail () { echo "❌ $*"; exit 1; }

strip_trailing_slash () {
  local s="$1"
  s="${s%/}"
  echo "$s"
}

http_code () {
  local url="$1"
  local out="$2"
  curl -sS -L --max-time 3 -o "${out}" -w "%{http_code}" "${url}" 2>/dev/null || echo "000"
}

# Determine backend base
CANDIDATES=()
if [[ -n "${SIDDES_API_BASE:-}" ]]; then
  CANDIDATES+=("$(strip_trailing_slash "${SIDDES_API_BASE}")")
fi
if [[ -n "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  CANDIDATES+=("$(strip_trailing_slash "${NEXT_PUBLIC_API_BASE}")")
fi
for p in 8000 8001 8002 8003 8080 8008; do
  CANDIDATES+=("http://localhost:${p}")

done

# de-dupe (bash 3.2 compatible)
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

API_BASE=""
_tmp="$(mktemp)"
for base in "${UNIQUE[@]}"; do
  code="$(http_code "${base}/healthz" "${_tmp}")"
  if [[ "${code}" == "200" ]]; then
    API_BASE="${base}"
    break
  fi

done
rm -f "${_tmp}" || true

if [[ -z "${API_BASE}" ]]; then
  fail "Could not reach backend /healthz. Start it first: ./scripts/dev/start_full_stack_docker.sh"
fi

say "✅ Backend detected: ${API_BASE}"

tmp_json() {
  mktemp
}

fetch_threads() {
  local viewer="$1"
  local side="$2"
  local url="${API_BASE}/api/inbox/threads?side=${side}&limit=50"
  local tmp
  tmp="$(tmp_json)"

  if [[ -n "${viewer}" ]]; then
    code="$(curl -sS -L --max-time 5 -H "x-sd-viewer: ${viewer}" -o "${tmp}" -w "%{http_code}" "${url}" 2>/dev/null || true)"
  else
    code="$(curl -sS -L --max-time 5 -o "${tmp}" -w "%{http_code}" "${url}" 2>/dev/null || true)"
  fi

  if [[ "${code}" != "200" ]]; then
    say "⚠️  ${url} -> ${code}"
    say "Body (first 300 chars):"
    head -c 300 "${tmp}" 2>/dev/null || true
    echo ""
    rm -f "${tmp}" || true
    return 1
  fi

  python3 - <<'PY' "$(cat "${tmp}")"
import json, sys
raw = sys.argv[1]
d = json.loads(raw)
r = bool(d.get('restricted'))
items = d.get('items') or []
print(('1' if r else '0') + ' ' + str(len(items)))
PY

  rm -f "${tmp}" || true
}

fetch_thread() {
  local viewer="$1"
  local thread_id="$2"
  local url="${API_BASE}/api/inbox/thread/${thread_id}?limit=10"
  local tmp
  tmp="$(tmp_json)"

  if [[ -n "${viewer}" ]]; then
    code="$(curl -sS -L --max-time 5 -H "x-sd-viewer: ${viewer}" -o "${tmp}" -w "%{http_code}" "${url}" 2>/dev/null || true)"
  else
    code="$(curl -sS -L --max-time 5 -o "${tmp}" -w "%{http_code}" "${url}" 2>/dev/null || true)"
  fi

  if [[ "${code}" != "200" ]]; then
    say "⚠️  ${url} -> ${code}"
    say "Body (first 300 chars):"
    head -c 300 "${tmp}" 2>/dev/null || true
    echo ""
    rm -f "${tmp}" || true
    return 1
  fi

  python3 - <<'PY' "$(cat "${tmp}")"
import json, sys
raw = sys.argv[1]
d = json.loads(raw)
r = bool(d.get('restricted'))
msgs = d.get('messages') or []
print(('1' if r else '0') + ' ' + str(len(msgs)))
PY

  rm -f "${tmp}" || true
}

assert_eq() {
  local got="$1"
  local want="$2"
  local msg="$3"
  if [[ "${got}" != "${want}" ]]; then
    fail "${msg} (got=${got}, want=${want})"
  fi
}

assert_gt0() {
  local got="$1"
  local msg="$2"
  if [[ "${got}" -le 0 ]]; then
    fail "${msg} (got=${got}, want>0)"
  fi
}

# 1) Missing viewer must be restricted
read r c <<<"$(fetch_threads "" "public")" || fail "fetch_threads missing-viewer failed"
assert_eq "${r}" "1" "missing viewer should be restricted"

# 2) anon can only see public
read r c <<<"$(fetch_threads "anon" "public")" || fail "fetch_threads anon/public failed"
assert_eq "${r}" "0" "anon/public should not be restricted"
assert_gt0 "${c}" "anon/public should return at least 1 thread"

read r c <<<"$(fetch_threads "anon" "close")" || fail "fetch_threads anon/close failed"
assert_eq "${r}" "0" "anon/close should not be restricted"
assert_eq "${c}" "0" "anon must not see close"

read r c <<<"$(fetch_threads "anon" "work")" || fail "fetch_threads anon/work failed"
assert_eq "${r}" "0" "anon/work should not be restricted"
assert_eq "${c}" "0" "anon must not see work"

# 3) friends cannot see close/work
read r c <<<"$(fetch_threads "friends" "friends")" || fail "fetch_threads friends/friends failed"
assert_eq "${r}" "0" "friends/friends should not be restricted"
assert_gt0 "${c}" "friends/friends should return at least 1 thread"

read r c <<<"$(fetch_threads "friends" "close")" || fail "fetch_threads friends/close failed"
assert_eq "${c}" "0" "friends must not see close"

read r c <<<"$(fetch_threads "friends" "work")" || fail "fetch_threads friends/work failed"
assert_eq "${c}" "0" "friends must not see work"

# 4) close can see close
read r c <<<"$(fetch_threads "close" "close")" || fail "fetch_threads close/close failed"
assert_gt0 "${c}" "close should return at least 1 close thread"

# 5) work can see work
read r c <<<"$(fetch_threads "work" "work")" || fail "fetch_threads work/work failed"
assert_gt0 "${c}" "work should return at least 1 work thread"

# 6) Thread endpoint cannot be probed to leak Close/Work
read r c <<<"$(fetch_thread "" "t_public_1")" || fail "fetch_thread missing-viewer/public failed"
assert_eq "${r}" "1" "missing viewer should be restricted on thread"

read r c <<<"$(fetch_thread "anon" "t_public_1")" || fail "fetch_thread anon/public failed"
assert_eq "${r}" "0" "anon/public thread should not be restricted"
assert_gt0 "${c}" "anon/public thread should return messages"

read r c <<<"$(fetch_thread "anon" "t_close_1")" || fail "fetch_thread anon/close failed"
assert_eq "${r}" "1" "anon must not open close thread"

read r c <<<"$(fetch_thread "friends" "t_close_1")" || fail "fetch_thread friends/close failed"
assert_eq "${r}" "1" "friends must not open close thread"

read r c <<<"$(fetch_thread "close" "t_close_1")" || fail "fetch_thread close/close failed"
assert_eq "${r}" "0" "close should open close thread"
assert_gt0 "${c}" "close thread should return messages"

read r c <<<"$(fetch_thread "friends" "t_work_1")" || fail "fetch_thread friends/work failed"
assert_eq "${r}" "1" "friends must not open work thread"

read r c <<<"$(fetch_thread "work" "t_work_1")" || fail "fetch_thread work/work failed"
assert_eq "${r}" "0" "work should open work thread"
assert_gt0 "${c}" "work thread should return messages"

say ""
say "✅ Inbox visibility smoke passed."
