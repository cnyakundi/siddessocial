#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts DB wiring + safe reply handling (sd_146b) =="

REQ=(
  "backend/siddes_post/views.py"
  "backend/siddes_post/runtime_store.py"
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

grep -q "SD_POST_STORE" backend/siddes_post/runtime_store.py && echo "✅ runtime_store reads SD_POST_STORE" || (echo "❌ runtime_store missing SD_POST_STORE" && exit 1)

# Must catch post_not_found in views
grep -q "post_not_found" backend/siddes_post/views.py && echo "✅ views handles post_not_found" || (echo "❌ views missing post_not_found handling" && exit 1)
grep -q "except ValueError as e" backend/siddes_post/views.py && echo "✅ views catches ValueError" || (echo "❌ views missing ValueError catch" && exit 1)

echo "✅ posts db wiring check passed"
