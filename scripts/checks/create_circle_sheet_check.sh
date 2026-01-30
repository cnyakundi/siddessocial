#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circle creation sheet wiring =="

PAGE_CANDIDATES=(
  "${PAGE}"
  "${PAGE}"
)
PAGE=""
for p in "${PAGE_CANDIDATES[@]}"; do
  if [[ -f "${p}" ]]; then PAGE="${p}"; break; fi
done
[[ -n "${PAGE}" ]] || { echo "❌ Missing circles/sets page"; exit 1; }

REQ=(
  "frontend/src/components/CreateCircleSheet.tsx"
  "${PAGE}"
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
[[ "$missing" -ne 0 ]] && exit 1

grep -q "CreateCircleSheet" "${PAGE}" && echo "✅ Circles page references CreateCircleSheet" || (echo "❌ Circles page missing CreateCircleSheet" && exit 1)

grep -q "New Circle" frontend/src/components/CreateSetSheet.tsx 2>/dev/null && echo "✅ Create sheet uses 'New Circle'" || true
echo "✅ create circle sheet check passed"
