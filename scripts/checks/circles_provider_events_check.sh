#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles provider get/update/events + local history =="

REQ=(
  "frontend/src/lib/setEvents.ts"
  "frontend/src/lib/setsProvider.ts"
  "frontend/src/lib/setsProviders/local.ts"
  "frontend/src/lib/setsProviders/backendStub.ts"
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

grep -q "export type CircleEvent" frontend/src/lib/setEvents.ts && echo "✅ CircleEvent type" || (echo "❌ CircleEvent type missing" && exit 1)

grep -q "get:" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider.get" || (echo "❌ setsProvider missing get" && exit 1)
grep -q "update:" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider.update" || (echo "❌ setsProvider missing update" && exit 1)
grep -q "events:" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider.events" || (echo "❌ setsProvider missing events" && exit 1)

grep -q "async update" frontend/src/lib/setsProviders/local.ts && echo "✅ local provider update" || (echo "❌ local provider missing update" && exit 1)
grep -q "appendCircleEvent" frontend/src/lib/setsProviders/local.ts && echo "✅ local provider appends events" || (echo "❌ local provider not recording events" && exit 1)

grep -q "method: \"PATCH\"" frontend/src/lib/setsProviders/backendStub.ts && echo "✅ backend_stub provider PATCH" || (echo "❌ backend_stub provider missing PATCH" && exit 1)
grep -q "/api/circles/" frontend/src/lib/setsProviders/backendStub.ts && echo "✅ backend_stub provider calls /api/circles/*" || (echo "❌ backend_stub provider not calling /api/circles/*" && exit 1)
grep -q "/events" frontend/src/lib/setsProviders/backendStub.ts && echo "✅ backend_stub provider fetches events" || (echo "❌ backend_stub provider missing events fetch" && exit 1)

grep -q "sd_136a" docs/STATE.md && echo "✅ STATE doc mentions sd_136a" || (echo "❌ docs/STATE.md missing sd_136a" && exit 1)
