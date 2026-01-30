#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles membership propagation (sd_140b) =="

REQ=(
  "frontend/src/lib/setsSignals.ts"
  "frontend/src/lib/inviteProviders/backendStub.ts"
  "frontend/src/app/siddes-circles/page.tsx"
  "frontend/src/app/siddes-circles/[id]/page.tsx"
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

grep -q "sd\.sets\.changed" frontend/src/lib/setsSignals.ts && echo "✅ Circles changed event constant" || (echo "❌ setsSignals missing event" && exit 1)

# Invite accept should emit sets change (provider-level)
grep -q "emitCirclesChanged" frontend/src/lib/inviteProviders/backendStub.ts && echo "✅ invites backend_stub emits sets change" || (echo "❌ invites backend_stub missing emitCirclesChanged" && exit 1)

# Circles pages listen for it
grep -q "onCirclesChanged" frontend/src/app/siddes-circles/page.tsx && echo "✅ Circles list listens" || (echo "❌ Circles list missing onCirclesChanged" && exit 1)
grep -q "onCirclesChanged" "frontend/src/app/siddes-circles/[id]/page.tsx" && echo "✅ Circles detail listens" || (echo "❌ Circles detail missing onCirclesChanged" && exit 1)

grep -q "sd_140b" docs/STATE.md && echo "✅ STATE doc mentions sd_140b" || (echo "❌ docs/STATE.md missing sd_140b" && exit 1)

echo "✅ Circles membership propagation check passed"
