#!/usr/bin/env bash
set -euo pipefail
echo "== Check: Django admin registers Siddes models (sd_164b) =="

F="backend/siddes_post/admin.py"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"

grep -q 'app_label).startswith("siddes_")' "$F" || { echo "❌ admin.py missing siddes_ registration rule"; exit 1; }

python3 -m py_compile "$F" backend/siddes_backend/admin_site.py
echo "✅ admin registration file compiles"
echo "✅ django admin registration check passed"
