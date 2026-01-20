#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Auth views do not drop QueryDict bodies (sd_165) =="

grep -q "request.data or {}" backend/siddes_auth/views.py || { echo "❌ siddes_auth/views.py missing mapping-friendly body parse"; exit 1; }
grep -q "request.data or {}" backend/siddes_contacts/views.py || { echo "❌ siddes_contacts/views.py missing mapping-friendly body parse"; exit 1; }

grep -q "isinstance(request.data, dict)" backend/siddes_auth/views.py && { echo "❌ siddes_auth/views.py still contains strict isinstance gate"; exit 1; } || true
grep -q "isinstance(request.data, dict)" backend/siddes_contacts/views.py && { echo "❌ siddes_contacts/views.py still contains strict isinstance gate"; exit 1; } || true

echo "✅ auth body parsing check passed"
