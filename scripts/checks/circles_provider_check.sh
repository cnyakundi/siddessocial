#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles provider (frontend, v2) =="

REQ=(
  "frontend/src/lib/setsProvider.ts"
  "frontend/src/lib/setsProviders/local.ts"
  "frontend/src/lib/sets.ts"
  "frontend/src/components/SideFeed.tsx"
)

for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ Missing: ${f}"
    exit 1
  fi
done

grep -q "export function getCirclesProvider" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider exports getCirclesProvider" || (echo "❌ setsProvider missing getCirclesProvider" && exit 1)

grep -q "side: SideId" frontend/src/lib/sets.ts && echo "✅ CircleDef includes side" || (echo "❌ CircleDef missing side" && exit 1)

grep -q "getCirclesProvider" frontend/src/components/SideFeed.tsx && echo "✅ SideFeed uses getCirclesProvider" || (echo "❌ SideFeed missing sets provider wiring" && exit 1)

# Real hydration-safe sets load: SideFeed must call setsProvider.list({ side }) inside an effect.
if grep -q "setsProvider" frontend/src/components/SideFeed.tsx && grep -q "\.list({ side })" frontend/src/components/SideFeed.tsx; then
  echo "✅ SideFeed loads Circles after mount (pattern)"
else
  echo "❌ SideFeed missing hydration-safe Circles load"
  exit 1
fi

echo "✅ sets provider check passed"
