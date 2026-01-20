#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Django DEBUG allows backend host (sd_166) =="

F="backend/siddes_backend/settings.py"
grep -q "SD_166_ALLOWED_HOSTS_DEV_PATCH" "$F" || { echo "❌ Missing sd_166 marker"; exit 1; }
grep -q 'for _h in ("backend", "localhost", "127.0.0.1")' "$F" || { echo "❌ Missing host tuple"; exit 1; }

echo "✅ allowed hosts dev patch present"
