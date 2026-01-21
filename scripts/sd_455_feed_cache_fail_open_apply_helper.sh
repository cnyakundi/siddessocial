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
BK="$ROOT/.backup_sd_455_feed_cache_fail_open_$TS"
mkdir -p "$BK"

FILE="$ROOT/backend/siddes_feed/views.py"
cp "$FILE" "$BK/views.py"

node - "$FILE" <<'NODE'
const fs = require("fs");
const file = process.argv[1];
let s = fs.readFileSync(file, "utf8");

let changed = 0;

// 1) Wrap cache.get in try/except
if (s.includes("cached = cache.get(cache_key)")) {
  s = s.replace(
    "            cached = cache.get(cache_key)\n",
    "            try:\n" +
    "                cached = cache.get(cache_key)\n" +
    "            except Exception:\n" +
    "                cached = None\n" +
    "                cache_key = None\n" +
    "                cache_status = \"bypass\"\n"
  );
  changed++;
}

// 2) Make cache_status miss conditional (only if cache_key still active)
if (s.includes("            cache_status = \"miss\"\n")) {
  s = s.replace(
    "            cache_status = \"miss\"\n",
    "            if cache_key is not None:\n" +
    "                cache_status = \"miss\"\n"
  );
  changed++;
}

if (changed < 2) {
  console.error("sd_455: patch did not fully apply (unexpected file shape). No write performed.");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_455: applied fail-open cache.get + conditional miss.");
NODE

echo "OK: sd_455 applied."
echo "Backup: $BK"
