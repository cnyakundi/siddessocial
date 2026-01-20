#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Support bundle script present (sd_330) =="

F="scripts/support/support_bundle.sh"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
[[ -x "$F" ]] || { echo "❌ Not executable: $F"; exit 1; }

echo "✅ $F exists + executable"
echo "✅ support bundle check passed"
