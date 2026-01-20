#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Next API proxy forwards cookies (sd_162) =="

FILES=(
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/app/api/sets/route.ts"
  "frontend/src/app/api/sets/[id]/route.ts"
  "frontend/src/app/api/invites/route.ts"
  "frontend/src/app/api/invites/[id]/route.ts"
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
)

missing=0
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
    # Only enforce on files that have proxy base logic
    if grep -q "SD_INTERNAL_API_BASE" "$f"; then
      grep -q 'cookie: req.headers.get("cookie")' "$f" || { echo "❌ $f missing cookie forwarding in proxy headers"; exit 1; }
    fi
  else
    echo "ℹ️ Missing (skip): $f"
    missing=1
  fi
done

echo "✅ cookie forwarding check passed"
