#!/usr/bin/env bash
set -euo pipefail
echo "== Check: Compose posts via /api/post (sd_153) =="
F="frontend/src/app/siddes-compose/page.tsx"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"
grep -q 'fetch("/api/post"' "$F" || grep -q "fetch('/api/post'" "$F" || { echo "❌ Compose submit not wired to /api/post"; exit 1; }
echo "✅ Compose posting wired"
