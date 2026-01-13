#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Visibility policy =="

REQ=(
  "backend/siddes_visibility/policy.py"
  "backend/siddes_visibility/demo.py"
  "docs/VISIBILITY_POLICY.md"
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

python3 -m py_compile backend/siddes_visibility/policy.py
PYTHONPATH="backend" python3 backend/siddes_visibility/demo.py --selftest >/dev/null
echo "✅ visibility policy selftest passed"
