#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Auth + Contacts wiring present (sd_160c) =="

SETTINGS="backend/siddes_backend/settings.py"
API="backend/siddes_backend/api.py"

grep -q "siddes_auth.apps.SiddesAuthConfig" "$SETTINGS" || { echo "❌ settings.py missing siddes_auth"; exit 1; }
grep -q "siddes_contacts.apps.SiddesContactsConfig" "$SETTINGS" || { echo "❌ settings.py missing siddes_contacts"; exit 1; }
echo "✅ settings.py wires apps"

grep -q 'path("auth/", include("siddes_auth.urls"))' "$API" || { echo "❌ api.py missing /api/auth include"; exit 1; }
grep -q 'path("contacts/", include("siddes_contacts.urls"))' "$API" || { echo "❌ api.py missing /api/contacts include"; exit 1; }
echo "✅ api.py wires routes"

[[ -f backend/siddes_contacts/tokens.py ]] || { echo "❌ missing tokens.py"; exit 1; }
[[ -f backend/siddes_contacts/normalize.py ]] || { echo "❌ missing normalize.py"; exit 1; }
echo "✅ contacts helpers exist"
