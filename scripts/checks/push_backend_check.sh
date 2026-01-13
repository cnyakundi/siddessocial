#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Push backend stubs =="

REQ=(
  "backend/siddes_push/models_stub.py"
  "backend/siddes_push/store.py"
  "backend/siddes_push/payloads.py"
  "backend/siddes_push/api_stub.py"
  "docs/PUSH_BACKEND.md"
  "scripts/dev/push_store_demo.py"
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

python3 -m py_compile backend/siddes_push/models_stub.py backend/siddes_push/store.py backend/siddes_push/payloads.py backend/siddes_push/api_stub.py

# Ensure imports work regardless of whether `backend` is a package
PYTHONPATH="backend" python3 scripts/dev/push_store_demo.py --selftest >/dev/null

echo "✅ push backend selftest passed"
