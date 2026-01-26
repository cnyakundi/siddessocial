#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Account deletion (backend + frontend) =="

PY="backend/siddes_auth/account_lifecycle.py"
URLS="backend/siddes_auth/urls.py"
CONFIRM="frontend/src/app/confirm-delete/page.tsx"
LEGAL="frontend/src/app/legal/account-deletion/page.tsx"

[[ -f "$PY" ]] || { echo "❌ Missing: $PY"; exit 1; }
[[ -f "$URLS" ]] || { echo "❌ Missing: $URLS"; exit 1; }
[[ -f "$CONFIRM" ]] || { echo "❌ Missing: $CONFIRM"; exit 1; }
[[ -f "$LEGAL" ]] || { echo "❌ Missing: $LEGAL"; exit 1; }

grep -q "class AccountDeleteRequestView" "$PY" || { echo "❌ Missing AccountDeleteRequestView in $PY"; exit 1; }
grep -q "class AccountDeleteConfirmView" "$PY" || { echo "❌ Missing AccountDeleteConfirmView in $PY"; exit 1; }

grep -q "account/delete/request" "$URLS" || { echo "❌ Missing account/delete/request in $URLS"; exit 1; }
grep -q "account/delete/confirm" "$URLS" || { echo "❌ Missing account/delete/confirm in $URLS"; exit 1; }

echo "✅ account deletion endpoints + pages present"
