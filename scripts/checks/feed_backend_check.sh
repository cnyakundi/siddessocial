#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Backend feed stub =="

REQ=(
  "backend/siddes_feed/mock_db.py"
  "backend/siddes_feed/feed_stub.py"
  "docs/FEED_BACKEND.md"
  "scripts/dev/feed_demo.py"
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

python3 -m py_compile backend/siddes_feed/mock_db.py backend/siddes_feed/feed_stub.py
PYTHONPATH="backend" python3 scripts/dev/feed_demo.py --selftest >/dev/null
echo "✅ feed backend selftest passed"
