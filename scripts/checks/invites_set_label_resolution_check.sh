#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Invites list resolves Circle labels (sd_141b) =="

REQ=(
  "frontend/src/app/siddes-invites/page.tsx"
  "frontend/src/lib/setsProvider.ts"
  "docs/STATE.md"
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

# Should attempt to resolve labels via Circles provider (best-effort)
grep -q "getCirclesProvider" frontend/src/app/siddes-invites/page.tsx && echo "✅ Imports getCirclesProvider" || (echo "❌ Invites page missing getCirclesProvider" && exit 1)
grep -q "hydrateSetLabels" frontend/src/app/siddes-invites/page.tsx && echo "✅ Hydrates set labels" || (echo "❌ Invites page missing hydrateSetLabels" && exit 1)
grep -q "sets\.get" frontend/src/app/siddes-invites/page.tsx && echo "✅ Fetches set detail via sets.get" || (echo "❌ Invites page missing sets.get" && exit 1)

# Accepted invites should surface Open Circle action
grep -q "Open Circle" frontend/src/app/siddes-invites/page.tsx && echo "✅ Open Circle action present" || (echo "❌ Invites page missing Open Circle action" && exit 1)

grep -q "sd_141b" docs/STATE.md && echo "✅ STATE doc mentions sd_141b" || (echo "❌ docs/STATE.md missing sd_141b" && exit 1)

echo "✅ Invites set label resolution check passed"
