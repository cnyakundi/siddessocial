#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Post detail endpoint stub =="

REQ=(
  "backend/siddes_post/detail_stub.py"
  "scripts/dev/post_detail_demo.py"
  "docs/POST_DETAIL_BACKEND.md"
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

python3 -m py_compile backend/siddes_post/detail_stub.py
PYTHONPATH="backend" python3 scripts/dev/post_detail_demo.py --selftest >/dev/null
echo "✅ post detail selftest passed"
