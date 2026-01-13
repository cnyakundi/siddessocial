#!/usr/bin/env bash
set -euo pipefail

echo "== Check: DRF auth skeleton (sd_118a) =="

# 1) Auth module exists
test -f backend/siddes_backend/drf_auth.py
echo "✅ backend/siddes_backend/drf_auth.py"

# 2) Settings wire authentication classes
grep -q "DEFAULT_AUTHENTICATION_CLASSES" backend/siddes_backend/settings.py
grep -q "siddes_backend.drf_auth.DevHeaderViewerAuthentication" backend/siddes_backend/settings.py
echo "✅ settings.py wires DevHeaderViewerAuthentication"

# 3) get_viewer_id must refuse dev headers in production
grep -q "if not getattr(settings, \"DEBUG\", False)" backend/siddes_inbox/views.py
echo "✅ get_viewer_id refuses dev headers when DEBUG=False"
