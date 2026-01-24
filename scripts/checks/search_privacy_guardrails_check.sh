#!/usr/bin/env bash
set -euo pipefail

# Search Privacy Guardrails (Siddes)
# Ensures SearchPostsView cannot leak across Sides.
# NOTE: Other endpoints may legitimately hardcode side="public" (e.g., UserPublicPostsView).
# We only enforce side-safety within SearchPostsView.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ ! -d "$ROOT/frontend" ] && [ -d "$(pwd)/frontend" ]; then
  ROOT="$(pwd)"
fi

fail() {
  echo "❌ Search privacy guardrails failed: $1"
  exit 1
}

V="$ROOT/backend/siddes_search/views.py"
A="$ROOT/frontend/src/app/api/search/posts/route.ts"

if [ ! -f "$V" ]; then
  fail "Missing backend/siddes_search/views.py"
fi

# Extract only the SearchPostsView block to avoid false failures from other views.
# Use awk (macOS/BSD awk compatible). Avoid reserved word 'in' as a variable name.
BLOCK="$(
  awk '
    BEGIN { in_block=0 }
    /^class SearchPostsView/ { in_block=1 }
    {
      if (in_block) {
        if ($0 ~ /^class / && $0 !~ /^class SearchPostsView/) { exit }
        print
      }
    }
  ' "$V"
)"

if [ -z "${BLOCK:-}" ]; then
  fail "Could not extract SearchPostsView block from backend/siddes_search/views.py"
fi

# Backend SearchPostsView must not hardcode public-only search
echo "$BLOCK" | grep -F 'Post.objects.filter(side="public"' >/dev/null 2>&1 && \
  fail "SearchPostsView hardcodes side=\"public\" in Post.objects.filter (must use side variable)"

# Backend SearchPostsView must enforce visibility
echo "$BLOCK" | grep -F '_can_view_record' >/dev/null 2>&1 || \
  fail "SearchPostsView does not reference _can_view_record (visibility enforcement)"

if [ ! -f "$A" ]; then
  fail "Missing frontend /api/search/posts route"
fi

# Frontend must read side from request
if ! grep -F 'searchParams.get("side")' "$A" >/dev/null 2>&1 && \
   ! grep -F "searchParams.get('side')" "$A" >/dev/null 2>&1; then
  fail "Frontend /api/search/posts route does not read side from URL"
fi

# Frontend must forward side to upstream query params (any URLSearchParams var name)
if ! grep -F '.set("side"' "$A" >/dev/null 2>&1 && \
   ! grep -F ".set('side'" "$A" >/dev/null 2>&1; then
  fail "Frontend /api/search/posts does not forward side param"
fi

echo "✅ Search privacy guardrails: OK"
