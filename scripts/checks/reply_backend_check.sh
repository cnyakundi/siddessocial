#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply backend stub =="

REQ=(
  "backend/siddes_reply/models_stub.py"
  "backend/siddes_reply/store.py"
  "backend/siddes_reply/endpoint_stub.py"
  "docs/REPLY_BACKEND.md"
  "scripts/dev/reply_demo.py"
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

python3 -m py_compile backend/siddes_reply/models_stub.py backend/siddes_reply/store.py backend/siddes_reply/endpoint_stub.py
PYTHONPATH="backend" python3 scripts/dev/reply_demo.py --selftest >/dev/null
echo "✅ reply backend selftest passed"
