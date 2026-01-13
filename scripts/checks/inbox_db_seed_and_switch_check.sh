#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox DB seed + switch (sd_121c) =="

must_file () {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "❌ Missing: $f"
    exit 1
  fi
  echo "✅ $f"
}

must_grep () {
  local pat="$1"
  local f="$2"
  if ! grep -q -- "$pat" "$f"; then
    echo "❌ $f missing pattern: $pat"
    exit 1
  fi
}

CMD="backend/siddes_inbox/management/commands/seed_inbox_demo.py"
SCRIPT="scripts/dev/inbox_db_seed.sh"
VIS="backend/siddes_inbox/visibility_stub.py"
VIEWS="backend/siddes_inbox/views.py"
DBSTORE="backend/siddes_inbox/store_db.py"

must_file "$CMD"
must_file "$SCRIPT"
must_file "$VIS"
must_file "$VIEWS"
must_file "$DBSTORE"

echo ""
echo "-- Seed command must exist --"
must_grep "class Command" "$CMD"
must_grep "InboxThread.objects.create" "$CMD"
must_grep "InboxMessage.objects.create" "$CMD"
must_grep "--reset" "$CMD"

echo ""
echo "-- Dev script must call seed command --"
must_grep "seed_inbox_demo" "$SCRIPT"

echo ""
echo "-- DRF viewer normalization must use resolve_viewer_role --"
must_grep "resolve_viewer_role" "$VIEWS"

echo ""
echo "-- DB store must enforce allowed sides + me-only move --"
must_grep "allowed_sides_for_role" "$DBSTORE"
must_grep "role_can_view" "$DBSTORE"
must_grep "if role != \"me\"" "$DBSTORE"

echo "✅ Inbox DB seed + switch check passed"
