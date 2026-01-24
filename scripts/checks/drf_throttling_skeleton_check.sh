#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: DRF throttling skeleton =="

# Settings should wire throttle classes + rates.
grep -q "DEFAULT_THROTTLE_CLASSES" backend/siddes_backend/settings.py
grep -q "SiddesScopedRateThrottle" backend/siddes_backend/settings.py
grep -q "DEFAULT_THROTTLE_RATES" backend/siddes_backend/settings.py

# Custom throttle class should exist.
[[ -f "backend/siddes_backend/throttles.py" ]]
grep -q "class SiddesScopedRateThrottle" backend/siddes_backend/throttles.py

# Views should declare scopes.
grep -q "throttle_scope = \"inbox_threads\"" backend/siddes_inbox/views.py
grep -q "throttle_scope = \"inbox_thread\"" backend/siddes_inbox/views.py
grep -q "inbox_send" backend/siddes_inbox/views.py
grep -q "throttle_scope = \"inbox_debug\"" backend/siddes_inbox/views.py

# Docs
[[ -f "docs/THROTTLING.md" ]]

echo "✅ DRF throttling skeleton present"
