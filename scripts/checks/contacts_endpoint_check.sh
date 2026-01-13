#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Contacts match endpoint stub =="

REQ=(
  "backend/siddes_contacts/endpoint_stub.py"
  "backend/siddes_contacts/django_view_example.py"
  "scripts/dev/contacts_match_demo.py"
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

python3 -m py_compile backend/siddes_contacts/endpoint_stub.py backend/siddes_contacts/django_view_example.py
PYTHONPATH="backend" python3 scripts/dev/contacts_match_demo.py --selftest >/dev/null
echo "✅ contacts match endpoint selftest passed"
