#!/usr/bin/env bash
set -euo pipefail

echo "== Check: docker-compose.dev.yml has no obsolete version key =="

FILE="ops/docker/docker-compose.dev.yml"
if [[ ! -f "$FILE" ]]; then
  echo "MISSING: $FILE"
  exit 1
fi

if grep -Eq '^version[[:space:]]*:' "$FILE"; then
  echo "FAIL: obsolete 'version:' key still present in $FILE"
  exit 1
fi

echo "OK: no version key present"
