#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets provider (frontend) =="

REQ=(
  "frontend/src/lib/setsProvider.ts"
  "frontend/src/lib/setsProviders/local.ts"
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

grep -q "export function getSetsProvider" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider exports getSetsProvider" || (echo "❌ setsProvider missing getSetsProvider" && exit 1)

grep -q "side: SideId" frontend/src/lib/sets.ts && echo "✅ SetDef includes side" || (echo "❌ SetDef missing side" && exit 1)

grep -q "getSetsProvider" frontend/src/components/SideFeed.tsx && echo "✅ SideFeed uses getSetsProvider" || (echo "❌ SideFeed missing sets provider wiring" && exit 1)

grep -q "Hydration-safe Sets load" frontend/src/components/SideFeed.tsx && echo "✅ SideFeed loads Sets after mount" || (echo "❌ SideFeed missing hydration-safe Sets load" && exit 1)
