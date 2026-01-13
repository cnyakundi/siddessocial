#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Sets membership propagation (sd_140b) =="

REQ=(
  "frontend/src/lib/setsSignals.ts"
  "frontend/src/lib/inviteProviders/backendStub.ts"
  "frontend/src/app/siddes-sets/page.tsx"
  "frontend/src/app/siddes-sets/[id]/page.tsx"
  "docs/STATE.md"
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

grep -q "sd\.sets\.changed" frontend/src/lib/setsSignals.ts && echo "✅ Sets changed event constant" || (echo "❌ setsSignals missing event" && exit 1)

# Invite accept should emit sets change (provider-level)
grep -q "emitSetsChanged" frontend/src/lib/inviteProviders/backendStub.ts && echo "✅ invites backend_stub emits sets change" || (echo "❌ invites backend_stub missing emitSetsChanged" && exit 1)

# Sets pages listen for it
grep -q "onSetsChanged" frontend/src/app/siddes-sets/page.tsx && echo "✅ Sets list listens" || (echo "❌ Sets list missing onSetsChanged" && exit 1)
grep -q "onSetsChanged" "frontend/src/app/siddes-sets/[id]/page.tsx" && echo "✅ Sets detail listens" || (echo "❌ Sets detail missing onSetsChanged" && exit 1)

grep -q "sd_140b" docs/STATE.md && echo "✅ STATE doc mentions sd_140b" || (echo "❌ docs/STATE.md missing sd_140b" && exit 1)

echo "✅ Sets membership propagation check passed"
