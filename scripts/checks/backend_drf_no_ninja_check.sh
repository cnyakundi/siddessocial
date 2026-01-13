#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Backend uses DRF (no Django Ninja) =="

# Requirements
if ! grep -q "djangorestframework" backend/requirements.txt; then
  echo "❌ backend/requirements.txt missing djangorestframework"
  exit 1
fi
if grep -q "django-ninja" backend/requirements.txt; then
  echo "❌ backend/requirements.txt still contains django-ninja"
  exit 1
fi

# Settings
if ! grep -q "\"rest_framework\"" backend/siddes_backend/settings.py; then
  echo "❌ rest_framework not listed in backend/siddes_backend/settings.py"
  exit 1
fi

# URL wiring
if ! grep -q "include(\"siddes_backend.api\")" backend/siddes_backend/urls.py; then
  echo "❌ backend/siddes_backend/urls.py is not including siddes_backend.api"
  exit 1
fi
if ! grep -q "include(\"siddes_inbox.urls\")" backend/siddes_backend/api.py; then
  echo "❌ backend/siddes_backend/api.py is not including siddes_inbox.urls"
  exit 1
fi

# Inbox views
if [[ ! -f "backend/siddes_inbox/views.py" ]]; then
  echo "❌ backend/siddes_inbox/views.py missing"
  exit 1
fi
if ! grep -q "APIView" backend/siddes_inbox/views.py; then
  echo "❌ backend/siddes_inbox/views.py does not appear to be DRF-based (missing APIView)"
  exit 1
fi

# Ensure we are not importing Ninja anywhere in the backend.
if grep -R "^from ninja\b\|^import ninja\b" -n backend/siddes_backend backend/siddes_inbox >/dev/null 2>&1; then
  echo "❌ Found Django Ninja imports in backend (should be none)"
  grep -R "^from ninja\b\|^import ninja\b" -n backend/siddes_backend backend/siddes_inbox || true
  exit 1
fi

echo "✅ DRF wiring present; no Ninja imports"
