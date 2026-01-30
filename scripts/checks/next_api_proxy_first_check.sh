#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Next API routes proxy-first to Django (sd_154) =="

REQ=(
  "frontend/src/app/api/circles/route.ts"
  "frontend/src/app/api/circles/[id]/route.ts"
  "frontend/src/app/api/invites/route.ts"
  "frontend/src/app/api/invites/[id]/route.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ missing: $f"
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

for f in "${REQ[@]}"; do
  grep -q "SD_INTERNAL_API_BASE" "$f" || { echo "❌ $f missing SD_INTERNAL_API_BASE wiring"; exit 1; }
  grep -q '"x-sd-viewer"' "$f" || { echo "❌ $f missing x-sd-viewer forwarding"; exit 1; }
done

echo "✅ proxy-first wiring present"
