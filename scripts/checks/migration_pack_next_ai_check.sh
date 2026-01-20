#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Migration pack for next AI present =="
[[ -f "docs/MIGRATION_PACK_NEXT_AI.md" ]] || { echo "❌ Missing docs/MIGRATION_PACK_NEXT_AI.md"; exit 1; }
grep -q "Tumblr-width" docs/MIGRATION_PACK_NEXT_AI.md || { echo "❌ Migration pack missing Tumblr width spec"; exit 1; }
grep -q "Kill stubs" docs/MIGRATION_PACK_NEXT_AI.md || { echo "❌ Migration pack missing kill stubs strategy"; exit 1; }
echo "✅ Migration pack present"
