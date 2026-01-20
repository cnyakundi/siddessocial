#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Demo universe seed scaffold (sd_157) =="

REQ=(
  "backend/siddes_post/management/commands/seed_demo_universe.py"
  "scripts/dev/seed_demo_universe.sh"
  "backend/siddes_feed/feed_stub.py"
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

python3 -m py_compile backend/siddes_post/management/commands/seed_demo_universe.py
python3 -m py_compile backend/siddes_feed/feed_stub.py

echo "✅ demo universe seed scaffold check passed"
