#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts create backend stub =="

REQ=(
  "backend/siddes_posts/models_stub.py"
  "backend/siddes_posts/store.py"
  "backend/siddes_posts/endpoint_stub.py"
  "docs/POSTS_CREATE_BACKEND.md"
  "scripts/dev/posts_create_demo.py"
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

python3 -m py_compile backend/siddes_posts/models_stub.py backend/siddes_posts/store.py backend/siddes_posts/endpoint_stub.py
PYTHONPATH="backend" python3 scripts/dev/posts_create_demo.py --selftest >/dev/null
echo "✅ posts create selftest passed"
