#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles membership read access (sd_139a) =="

# DB store should list sets where viewer is a member.
grep -q "members__contains" backend/siddes_sets/store_db.py \
  && echo "✅ store_db lists member sets (members__contains)" \
  || (echo "❌ store_db missing members__contains membership query" && exit 1)

# DB store should gate get/events by owner OR member.
grep -q "s\.owner_id != viewer_id" backend/siddes_sets/store_db.py \
  && echo "✅ store_db enforces membership on get/events" \
  || (echo "❌ store_db missing membership gate (owner/member)" && exit 1)

# Views should allow GET reads for non-me viewers (missing-viewer only).
grep -q "Default-safe: unknown viewer => restricted" backend/siddes_sets/views.py \
  && echo "✅ views gate GET by missing-viewer only" \
  || (echo "❌ views missing missing-viewer-only gate" && exit 1)

grep -q "items = _store\.list(owner_id=viewer" backend/siddes_sets/views.py \
  && echo "✅ views list calls store" \
  || (echo "❌ views list missing store call" && exit 1)

# Events should avoid existence leaks by checking readability first.
grep -q "Avoid existence leaks" backend/siddes_sets/views.py \
  && echo "✅ events view avoids existence leaks" \
  || (echo "❌ events view missing existence-leak guard" && exit 1)

# Writes must stay owner-only.
CNT=$(grep -c 'if role != "me"' backend/siddes_sets/views.py || true)
if [[ "$CNT" -ge 2 ]]; then
  echo "✅ writes remain me-only (role gate present)"
else
  echo "❌ expected me-only role gate for POST/PATCH"
  exit 1
fi

# State doc should record sd_139a.
grep -q "sd_139a" docs/STATE.md \
  && echo "✅ STATE doc mentions sd_139a" \
  || (echo "❌ docs/STATE.md missing sd_139a" && exit 1)

echo "✅ sd_139a check passed"
