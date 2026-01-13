#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets Django router + app install =="

REQ=(
  "backend/siddes_sets/urls.py"
  "backend/siddes_backend/api.py"
  "backend/siddes_backend/settings.py"
  "backend/siddes_backend/middleware.py"
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

grep -q 'include("siddes_sets.urls")' backend/siddes_backend/api.py && echo "✅ api.py includes siddes_sets.urls" || (echo "❌ backend api missing siddes_sets router" && exit 1)

grep -q 'SiddesSetsConfig' backend/siddes_backend/settings.py && echo "✅ settings installs SiddesSetsConfig" || (echo "❌ settings.py missing siddes_sets app" && exit 1)

grep -q 'PATCH' backend/siddes_backend/middleware.py && echo "✅ Dev CORS allows PATCH" || (echo "❌ Dev CORS missing PATCH (needed for Sets update)" && exit 1)

# Marker: keep state history honest
if grep -q "sd_134" docs/STATE.md; then
  echo "✅ STATE doc still includes sd_134 Sets ladder"
else
  echo "❌ docs/STATE.md missing Sets ladder marker sd_134"
  exit 1
fi
