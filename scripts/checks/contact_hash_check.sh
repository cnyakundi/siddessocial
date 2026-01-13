#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Contact hashing (HMAC tokens) =="

REQ=(
  "backend/siddes_contacts/normalize.py"
  "backend/siddes_contacts/tokens.py"
  "backend/siddes_contacts/match.py"
  "scripts/dev/contacts_hash_demo.py"
  "docs/CONTACT_MATCHING.md"
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

python3 -m py_compile backend/siddes_contacts/normalize.py backend/siddes_contacts/tokens.py backend/siddes_contacts/match.py

# Ensure imports work regardless of whether `backend` is a package
PYTHONPATH="backend" python3 scripts/dev/contacts_hash_demo.py --selftest >/dev/null

echo "✅ contact hashing selftest passed"
