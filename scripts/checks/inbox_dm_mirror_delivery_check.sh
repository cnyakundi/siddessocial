#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Inbox DM mirror delivery guardrails (sd_786) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }
must_grep () {
  local pat="$1"
  local f="$2"
  if ! grep -q -- "$pat" "$f"; then
    echo "❌ $f missing pattern: $pat"
    exit 1
  fi
}

DBSTORE="backend/siddes_inbox/store_db.py"
STATE="docs/STATE.md"
CMD="backend/siddes_inbox/management/commands/inbox_dm_smoke.py"
RUNNER="scripts/dev/inbox_dm_smoke.sh"

req "$DBSTORE"
req "$STATE"
req "$CMD"
req "$RUNNER"

echo ""
echo "-- store_db: must include mirror delivery + handle fallback --"
must_grep "sd_748_mirror_delivery" "$DBSTORE"
must_grep "_resolve_user_id_from_handle" "$DBSTORE"
must_grep "sd_785_dm_delivery_handle_fallback" "$DBSTORE"
must_grep "sd_785_dm_bootstrap_uid_resolve" "$DBSTORE"

echo ""
echo "-- STATE doc must mention sd_786 --"
must_grep "sd_786" "$STATE"

echo ""
echo "✅ sd_786 guardrails check passed"
