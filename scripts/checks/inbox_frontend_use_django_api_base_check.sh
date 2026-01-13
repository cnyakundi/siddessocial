#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox frontend uses Django API base (Ninja or DRF) =="

REQ=(
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/lib/inboxProvider.ts"
  "backend/siddes_backend/settings.py"
  "backend/siddes_backend/api.py"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ missing: ${f}"
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

# Provider must reference the env base and keep safe fallback behavior.
if grep -q "NEXT_PUBLIC_API_BASE" frontend/src/lib/inboxProviders/backendStub.ts; then
  echo "✅ provider references NEXT_PUBLIC_API_BASE"
else
  echo "❌ provider does not reference NEXT_PUBLIC_API_BASE"
  exit 1
fi

if grep -q "sd_viewer" frontend/src/lib/inboxProviders/backendStub.ts; then
  echo "✅ provider reads sd_viewer cookie for viewer fallback"
else
  echo "❌ provider does not read sd_viewer cookie"
  exit 1
fi

if grep -q "fetchWithFallback" frontend/src/lib/inboxProviders/backendStub.ts; then
  echo "✅ provider keeps safe fallback to same-origin stubs"
else
  echo "❌ provider missing fallback helper"
  exit 1
fi

if grep -q "NEXT_PUBLIC_API_BASE" frontend/src/lib/inboxProvider.ts && grep -q "backendStubProvider" frontend/src/lib/inboxProvider.ts; then
  echo "✅ getInboxProvider knows about NEXT_PUBLIC_API_BASE"
else
  echo "❌ getInboxProvider logic missing"
  exit 1
fi

# Backend mode (Ninja vs DRF) — tolerate both.
MODE=""
if [[ -f "backend/requirements.txt" ]] && grep -qi "djangorestframework" backend/requirements.txt; then
  MODE="drf"
elif [[ -f "backend/requirements.txt" ]] && grep -qi "django-ninja" backend/requirements.txt; then
  MODE="ninja"
fi

echo "• Detected backend API mode: ${MODE:-unknown}"

if [[ "${MODE}" == "drf" ]]; then
  if grep -q '"rest_framework"' backend/siddes_backend/settings.py; then
    echo "✅ backend is DRF-based (rest_framework installed)"
  else
    echo "❌ DRF mode detected but settings missing rest_framework"
    exit 1
  fi
elif [[ "${MODE}" == "ninja" ]]; then
  # Older Ninja setup used csrf=False in api router wiring. Don't fail hard if absent.
  if grep -q "csrf=False" backend/siddes_backend/api.py; then
    echo "✅ backend is Ninja-based (csrf disabled for API)"
  else
    echo "✅ backend is Ninja-based (csrf flag not required by this check)"
  fi
else
  echo "⚠️  Could not detect backend mode from backend/requirements.txt (continuing)"
fi

echo "✅ inbox frontend API base check passed"
