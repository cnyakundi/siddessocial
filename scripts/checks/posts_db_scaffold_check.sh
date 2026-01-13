#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Posts+Replies DB scaffold (sd_146a) =="

REQ=(
  "backend/siddes_post/models.py"
  "backend/siddes_post/store_db.py"
  "backend/siddes_post/migrations/0001_initial.py"
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

# Must NOT define a separate models.Field named post_id (Django FK already has post_id)
if grep -n "post_id = models" backend/siddes_post/models.py >/dev/null 2>&1; then
  echo "❌ Reply model defines post_id field (clashes with ForeignKey). Remove it."
  grep -n "post_id = models" backend/siddes_post/models.py || true
  exit 1
fi
echo "✅ no post_id field defined (safe)"

grep -q "SD_POST_STORE" backend/siddes_post/runtime_store.py && echo "✅ runtime_store reads SD_POST_STORE" || (echo "❌ runtime_store missing SD_POST_STORE" && exit 1)
grep -q "DbPostStore" backend/siddes_post/runtime_store.py && echo "✅ runtime_store wires DbPostStore" || (echo "❌ runtime_store missing DbPostStore" && exit 1)

echo "✅ posts db scaffold check passed"
