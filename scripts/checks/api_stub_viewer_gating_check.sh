#!/usr/bin/env bash
set -euo pipefail

echo "== Check: API stub viewer gating (no ?viewer=) =="

REQ=(
  "frontend/src/lib/server/stubViewer.ts"
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/post/[id]/route.ts"
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

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

# Feed and post/[id] must not accept viewer identity from URL query params.
if grep -q "searchParams.get(\"viewer\")" "frontend/src/app/api/feed/route.ts"; then
  echo "❌ feed route accepts viewer via query param"
  exit 1
fi
if grep -q "searchParams.get(\"viewer\")" "frontend/src/app/api/post/[id]/route.ts"; then
  echo "❌ post/[id] route accepts viewer via query param"
  exit 1
fi
echo "✅ API routes do not accept ?viewer="

# Must use resolveStubViewer for identity (default-safe).
if grep -q "resolveStubViewer" "frontend/src/app/api/feed/route.ts" &&        grep -q "resolveStubViewer" "frontend/src/app/api/post/route.ts" &&        grep -q "resolveStubViewer" "frontend/src/app/api/post/[id]/route.ts"; then
  echo "✅ API routes use resolveStubViewer"
else
  echo "❌ API routes missing resolveStubViewer usage"
  exit 1
fi
