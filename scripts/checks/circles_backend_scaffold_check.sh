#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles backend scaffold =="

REQ=(
  "backend/siddes_sets/__init__.py"
  "backend/siddes_sets/models_stub.py"
  "backend/siddes_sets/store.py"
  "backend/siddes_sets/endpoint_stub.py"
  "backend/siddes_sets/django_ninja_template.py"
  "backend/siddes_sets/drf_template.py"
  "docs/SETS_BACKEND.md"
  "scripts/dev/sets_demo.py"
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

python3 -m py_compile backend/siddes_sets/models_stub.py backend/siddes_sets/store.py backend/siddes_sets/endpoint_stub.py
PYTHONPATH="backend" python3 scripts/dev/sets_demo.py --selftest >/dev/null
echo "✅ sets backend selftest passed"
