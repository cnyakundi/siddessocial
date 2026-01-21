#!/usr/bin/env bash
set -euo pipefail

find_repo_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: run this from inside the repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_455_r2_feed_cache_fail_open_$TS"
mkdir -p "$BK"

patch_one() {
  local FILE="$1"
  [ -f "$FILE" ] || return 0

  echo "Patching: $FILE"
  cp "$FILE" "$BK/$(echo "$FILE" | tr '/' '__')"

  export FILE
  node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) throw new Error("FILE env var missing");

let s = fs.readFileSync(file, "utf8");
const before = s;

// Patch 1: wrap cache.get in try/except (fail-open)
s = s.replace(
  /^(\s*)cached = cache\.get\(cache_key\)\s*$/m,
  (_, ind) =>
    `${ind}try:\n` +
    `${ind}    cached = cache.get(cache_key)\n` +
    `${ind}except Exception:\n` +
    `${ind}    cached = None\n` +
    `${ind}    cache_key = None\n` +
    `${ind}    cache_status = "bypass"`
);

// Patch 2: don't set cache_status="miss" if we just disabled cache_key
s = s.replace(
  /^(\s*)cache_status = "miss"\s*$/m,
  (_, ind) =>
    `${ind}if cache_key is not None:\n` +
    `${ind}    cache_status = "miss"`
);

if (s === before) {
  console.error("sd_455_r2: No changes made (patterns not found).");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_455_r2: applied fail-open cache.get + guarded miss.");
NODE
}

# Patch the main tree (and the nested copy if it exists)
patch_one "$ROOT/backend/siddes_feed/views.py"
patch_one "$ROOT/siddessocial/backend/siddes_feed/views.py"

echo "OK: sd_455_r2 applied."
echo "Backup: $BK"
