#!/usr/bin/env bash
set -euo pipefail

echo "== Check: 'Rooms' term banned (sd_148a) =="

FILES=(
  "frontend/src/lib/sets.ts"
  "frontend/src/lib/server/setsStore.ts"
  "docs/SETS_BACKEND.md"
  "backend/siddes_sets/models.py"
  "backend/siddes_sets/__init__.py"
)

missing=0
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done
[[ "$missing" -ne 0 ]] && exit 1

# Fail if word-boundary room/rooms exists (case-insensitive)
for f in "${FILES[@]}"; do
  if grep -Eiq '\brooms?\b' "$f"; then
    echo "❌ Banned term found in $f:"
    grep -Ein '\brooms?\b' "$f" || true
    exit 1
  fi
done

echo "✅ rooms term banned check passed"
