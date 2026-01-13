#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Public Trust Gates (sd_133) =="

REQ=(
  "frontend/src/lib/flags.ts"
  "frontend/src/lib/server/stubTrust.ts"
  "frontend/src/lib/server/publicTrustGates.ts"
  "frontend/src/app/api/post/route.ts"
  "frontend/src/app/api/post/[id]/reply/route.ts"
  "docs/PUBLIC_TRUST_GATES.md"
  "ops/docker/.env.example"
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

need() {
  local file="$1"
  local pat="$2"
  if grep -qE "$pat" "$file"; then
    echo "✅ $file matches: $pat"
  else
    echo "❌ $file missing pattern: $pat"
    exit 1
  fi
}

need "frontend/src/lib/flags.ts" "publicTrustGates"
need "ops/docker/.env.example" "NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES"
need "frontend/src/lib/server/publicTrustGates.ts" "NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES"
need "frontend/src/lib/server/publicTrustGates.ts" "enforcePublicWriteGates"
need "frontend/src/lib/server/publicTrustGates.ts" "textHasLink"
need "frontend/src/lib/server/publicTrustGates.ts" "checkMinInterval"
need "frontend/src/lib/server/stubTrust.ts" "sd_trust"
need "frontend/src/app/api/post/route.ts" "resolveStubTrust"
need "frontend/src/app/api/post/route.ts" "publicTrustGatesEnabled"
need "frontend/src/app/api/post/route.ts" "enforcePublicWriteGates"
need "docs/STATE.md" "sd_133"
need "docs/PUBLIC_TRUST_GATES.md" "sd_133"

echo "✅ Public Trust Gates check passed"
