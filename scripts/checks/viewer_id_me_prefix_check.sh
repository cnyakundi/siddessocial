#!/usr/bin/env bash
set -euo pipefail

echo "== Check: viewer id uses me_<id> for authenticated users (sd_163) =="

FILES=(
  "backend/siddes_sets/views.py"
  "backend/siddes_post/views.py"
  "backend/siddes_invites/views.py"
)

for f in "${FILES[@]}"; do
  echo "• $f"
  grep -q 'return f"me_{uid}"' "$f" || { echo "❌ $f missing me_<id> return for authenticated user"; exit 1; }
done
echo "✅ sets/post/invites use me_<id>"

grep -q 'return f"me_{uid}"' backend/siddes_inbox/views.py || { echo "❌ inbox get_viewer_id not returning me_<id>"; exit 1; }
echo "✅ inbox uses me_<id>"

grep -q "def _raw_viewer_from_request" backend/siddes_feed/views.py || { echo "❌ feed missing _raw_viewer_from_request"; exit 1; }
grep -q 'return f"me_{uid}"' backend/siddes_feed/views.py || { echo "❌ feed not returning me_<id> for authenticated users"; exit 1; }
grep -q 'if not getattr(settings, "DEBUG", False):' backend/siddes_feed/views.py || { echo "❌ feed missing prod safety guard"; exit 1; }
echo "✅ feed uses me_<id> + prod safety"

python3 -m py_compile backend/siddes_sets/views.py backend/siddes_post/views.py backend/siddes_invites/views.py backend/siddes_inbox/views.py backend/siddes_feed/views.py

echo "✅ viewer id check passed"
