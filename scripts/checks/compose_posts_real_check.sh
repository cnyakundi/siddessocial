#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Compose posts via /api/post (sd_153) =="

F_PAGE="frontend/src/app/siddes-compose/page.tsx"
F_CLIENT="frontend/src/app/siddes-compose/client.tsx"
F_MVP="frontend/src/app/siddes-compose/ComposeMVP.tsx"

[[ -f "$F_PAGE" ]] || { echo "❌ Missing: $F_PAGE"; exit 1; }
[[ -f "$F_CLIENT" ]] || { echo "❌ Missing: $F_CLIENT"; exit 1; }
[[ -f "$F_MVP" ]] || { echo "❌ Missing: $F_MVP"; exit 1; }

echo "✅ $F_PAGE"
echo "✅ $F_CLIENT"
echo "✅ $F_MVP"

# Posting is wired in the browser component.
# Accept either quote style, and allow refactors (client wrapper → ComposeMVP).
grep -q 'fetch("/api/post"' "$F_CLIENT" \
  || grep -q "fetch('/api/post'" "$F_CLIENT" \
  || grep -q 'fetch("/api/post"' "$F_MVP" \
  || grep -q "fetch('/api/post'" "$F_MVP" \
  || { echo "❌ Compose submit not wired to /api/post"; exit 1; }

echo "✅ Compose posting wired"
