#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Migration master prompt present (sd_152h) =="

[[ -f "docs/MIGRATION_MASTER_PROMPT.md" ]] || { echo "❌ Missing docs/MIGRATION_MASTER_PROMPT.md"; exit 1; }
grep -q "Tumblr-width" docs/MIGRATION_MASTER_PROMPT.md || { echo "❌ Prompt missing Tumblr-width requirement"; exit 1; }
grep -q "kill stubs" docs/MIGRATION_MASTER_PROMPT.md || { echo "❌ Prompt missing kill stubs strategy"; exit 1; }

echo "✅ Migration master prompt OK"
