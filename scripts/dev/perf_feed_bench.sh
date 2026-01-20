#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:3000/api/feed?side=public}"
N="${N:-25}"
WARM="${WARM:-3}"

say() { printf "%s\n" "$*"; }

CURL=(curl -sS -o /dev/null -w "%{time_total}\n")

# Optional: DEV identity (only respected by backend when DEBUG=True)
if [[ -n "${SD_VIEWER:-}" ]]; then
  CURL+=( -H "x-sd-viewer: ${SD_VIEWER}" )
fi

# Optional: pass browser cookies if you want to benchmark session-auth.
# Example:
#   COOKIE='sessionid=...; csrftoken=...' ./scripts/dev/perf_feed_bench.sh 'http://localhost:3000/api/feed?side=friends'
if [[ -n "${COOKIE:-}" ]]; then
  CURL+=( -H "cookie: ${COOKIE}" )
fi

# Optional: cookie jar file (curl -c jar.txt in one request, then reuse via COOKIE_JAR=jar.txt)
if [[ -n "${COOKIE_JAR:-}" ]]; then
  CURL+=( -b "${COOKIE_JAR}" )
fi

say "== perf_feed_bench =="
say "URL: $URL"
say "N: $N (warm: $WARM)"
[[ -n "${SD_VIEWER:-}" ]] && say "x-sd-viewer: $SD_VIEWER"
[[ -n "${COOKIE_JAR:-}" ]] && say "cookie_jar: $COOKIE_JAR"

# Warmup (ignore failures)
for _ in $(seq 1 "$WARM"); do
  "${CURL[@]}" "$URL" >/dev/null || true
done

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for _ in $(seq 1 "$N"); do
  "${CURL[@]}" "$URL" >> "$tmp"
done

python3 - "$tmp" <<'PY'
import sys, statistics, math
path = sys.argv[1]
vals = []
with open(path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            vals.append(float(line) * 1000.0)  # ms
        except Exception:
            pass

if not vals:
    print("No timings collected.")
    raise SystemExit(1)

vals.sort()

def pct(p):
    k = (len(vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals[int(k)]
    return vals[f] * (c - k) + vals[c] * (k - f)

mean = sum(vals) / len(vals)
med = statistics.median(vals)
print("\nResults (ms):")
print(f"  min: {vals[0]:.1f}")
print(f"  p50: {med:.1f}")
print(f"  avg: {mean:.1f}")
print(f"  p95: {pct(95):.1f}")
print(f"  p99: {pct(99):.1f}")
print(f"  max: {vals[-1]:.1f}")
PY
