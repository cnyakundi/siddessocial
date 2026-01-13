#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Offline post queue =="

REQ=(
  "frontend/src/lib/offlineQueue.ts"
  "frontend/src/components/QueueIndicator.tsx"
  "frontend/src/components/AppProviders.tsx"
  "frontend/src/app/siddes-compose/page.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if grep -q "QueueIndicator" "frontend/src/components/AppProviders.tsx"; then
  echo "✅ AppProviders wires QueueIndicator"
else
  echo "❌ QueueIndicator not wired into AppProviders"
  exit 1
fi
