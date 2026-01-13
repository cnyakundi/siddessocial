#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Invites list resolves Set labels (sd_141b) =="

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

# Should attempt to resolve labels via Sets provider (best-effort)
grep -q "getSetsProvider" frontend/src/app/siddes-invites/page.tsx && echo "✅ Imports getSetsProvider" || (echo "❌ Invites page missing getSetsProvider" && exit 1)
grep -q "hydrateSetLabels" frontend/src/app/siddes-invites/page.tsx && echo "✅ Hydrates set labels" || (echo "❌ Invites page missing hydrateSetLabels" && exit 1)
grep -q "sets\.get" frontend/src/app/siddes-invites/page.tsx && echo "✅ Fetches set detail via sets.get" || (echo "❌ Invites page missing sets.get" && exit 1)

# Accepted invites should surface Open Set action
grep -q "Open Set" frontend/src/app/siddes-invites/page.tsx && echo "✅ Open Set action present" || (echo "❌ Invites page missing Open Set action" && exit 1)

grep -q "sd_141b" docs/STATE.md && echo "✅ STATE doc mentions sd_141b" || (echo "❌ docs/STATE.md missing sd_141b" && exit 1)

echo "✅ Invites set label resolution check passed"
