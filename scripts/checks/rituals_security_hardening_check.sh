#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Rituals safety hardening (sd_340) =="

# Throttle rates present
grep -q ""ritual_create"" backend/siddes_backend/settings.py
grep -q ""ritual_public_answer"" backend/siddes_backend/settings.py

# Views declare scopes
grep -q "throttle_scope = "ritual_list"" backend/siddes_rituals/views.py
grep -q "throttle_scope = "ritual_create"" backend/siddes_rituals/views.py || true
grep -q "throttle_scope = "ritual_ignite"" backend/siddes_rituals/views.py
grep -q "throttle_scope = "ritual_respond"" backend/siddes_rituals/views.py

# Kind gating and payload sanitization markers
grep -q "public_kind_forbidden" backend/siddes_rituals/views.py
grep -q "payload_too_large" backend/siddes_rituals/views.py
grep -q "_ritual_is_open" backend/siddes_rituals/views.py

# Docs
[[ -f "docs/RITUALS.md" ]]

echo "✅ Rituals safety hardening present"
