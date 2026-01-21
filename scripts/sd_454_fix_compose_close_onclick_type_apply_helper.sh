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
BK="$ROOT/.backup_sd_454_fix_compose_close_onclick_type_$TS"
mkdir -p "$BK"

FILE="$ROOT/frontend/src/app/siddes-compose/client.tsx"
cp "$FILE" "$BK/client.tsx"

node <<'NODE'
const fs = require("fs");

const file = process.argv[1];
let s = fs.readFileSync(file, "utf8");

const re = /onClick=\{close\}/g;
const count = (s.match(re) || []).length;

s = s.replace(re, "onClick={() => close()}");

fs.writeFileSync(file, s);

console.log(`sd_454: replaced ${count} occurrence(s) of onClick={close} -> onClick={() => close()}`);
if (count === 0) process.exit(2);
NODE "$FILE"

echo "OK: sd_454 applied."
echo "Backup: $BK"
