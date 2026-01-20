#!/usr/bin/env bash
set -euo pipefail
echo "== Check: Next /api/feed proxies to backend when configured (sd_153) =="
F="frontend/src/app/api/feed/route.ts"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"
grep -q "SD_INTERNAL_API_BASE" "$F" || { echo "❌ missing SD_INTERNAL_API_BASE proxy logic"; exit 1; }
grep -q "fetchJson" "$F" || { echo "❌ missing fetchJson helper"; exit 1; }
echo "✅ feed route proxy logic present"
