#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: UI docs pack present (sd_152e) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }

req "docs/UI_HEARTBEAT.md"
req "docs/UI_MASTER_SPEC.md"
req "docs/UI_STATUS_MATRIX.md"

grep -q "Side = context mode" docs/UI_HEARTBEAT.md || { echo "❌ UI_HEARTBEAT missing Side definition"; exit 1; }
grep -q "UI Master Spec" docs/UI_MASTER_SPEC.md || { echo "❌ UI_MASTER_SPEC missing title"; exit 1; }
grep -q "Status Matrix" docs/UI_STATUS_MATRIX.md || { echo "❌ UI_STATUS_MATRIX missing title"; exit 1; }

echo "✅ UI docs pack OK"
