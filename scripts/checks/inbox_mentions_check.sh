#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox mentions + side context =="

REQ=(
  "frontend/src/lib/mockPeople.ts"
  "frontend/src/components/MentionPicker.tsx"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
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

PAGE="frontend/src/app/siddes-inbox/[id]/page.tsx"

if grep -q "MentionPicker" "$PAGE"   && (grep -q 'data-testid="thread-context-strip"' "$PAGE" || grep -q "Context:" "$PAGE"); then
  echo "✅ MentionPicker + context strip present"
else
  echo "❌ MentionPicker/context strip missing"
  exit 1
fi
