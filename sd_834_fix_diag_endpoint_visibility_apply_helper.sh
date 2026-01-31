#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_834_fix_diag_endpoint_visibility"
TS="$(date +%Y%m%d_%H%M%S)"

find_repo_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" ]] && [[ -d "$d/backend" ]] && [[ -d "$d/scripts" ]]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Run from inside the repo (must contain ./frontend ./backend ./scripts)." >&2
  echo "Tip: cd /Users/cn/Downloads/sidesroot" >&2
  exit 1
fi

cd "$ROOT"

SRC_DIR="frontend/src/app/api/_diag"
SRC_FILE="${SRC_DIR}/route.ts"
DST_DIR="frontend/src/app/api/diag"
DST_FILE="${DST_DIR}/route.ts"
NEXT_CFG="frontend/next.config.js"

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
if [[ -f "$SRC_FILE" ]]; then
  mkdir -p "$BK/${SRC_DIR}"
  cp -a "$SRC_FILE" "$BK/${SRC_FILE}"
fi
if [[ -f "$NEXT_CFG" ]]; then
  mkdir -p "$BK/frontend"
  cp -a "$NEXT_CFG" "$BK/${NEXT_CFG}"
fi

echo "== ${SD_ID}: make /api/_diag reachable (Next private-folder fix) =="

if [[ ! -f "$SRC_FILE" ]]; then
  echo "ERROR: Missing ${SRC_FILE} (expected). Your repo docs reference /api/_diag." >&2
  echo "Fix: git pull, or recreate the diag route first." >&2
  exit 1
fi

mkdir -p "$DST_DIR"
cp -a "$SRC_FILE" "$DST_FILE"
echo "✅ Copied: ${SRC_FILE} -> ${DST_FILE}"

# Patch next.config.js to rewrite /api/_diag -> /api/diag (so old callers keep working)
if [[ ! -f "$NEXT_CFG" ]]; then
  echo "ERROR: Missing ${NEXT_CFG}" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/next.config.js")
s = p.read_text(encoding="utf-8")

# Already has rewrites?
if re.search(r'\basync\s+rewrites\s*\(', s):
    if "/api/_diag" in s and "/api/diag" in s:
        print("OK: next.config.js already has rewrites() + diag mapping.")
        raise SystemExit(0)
    print("WARN: next.config.js already has rewrites(); ensure /api/_diag -> /api/diag is present.")
    raise SystemExit(0)

marker = "async headers()"
idx = s.find(marker)
if idx == -1:
    raise SystemExit("ERROR: Could not find 'async headers()' in next.config.js (unexpected format).")

insertion = '''async rewrites() {
    return [
      { source: "/api/_diag", destination: "/api/diag" },
    ];
  },

'''

s2 = s[:idx] + insertion + s[idx:]
p.write_text(s2, encoding="utf-8")
print("OK: inserted rewrites() mapping /api/_diag -> /api/diag")
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}"
echo ""
echo "Next:"
echo "  1) Restart frontend (docker dev):"
echo "     docker compose -f ops/docker/docker-compose.dev.yml up -d --build frontend"
echo ""
echo "  2) Verify:"
echo "     curl -s http://localhost:3000/api/_diag | head -n 30"
echo "     curl -s http://localhost:3000/api/diag  | head -n 30"
echo ""
echo "Expected: JSON (not HTML 404)."
