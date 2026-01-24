#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Django project bootstrap + Inbox API wiring =="

# Base files always required
BASE_REQ=(
  "backend/manage.py"
  "backend/requirements.txt"
  "backend/siddes_backend/settings.py"
  "backend/siddes_backend/urls.py"
)

missing=0
for f in "${BASE_REQ[@]}"; do
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

# Detect mode from requirements
MODE=""
if grep -qi "djangorestframework" backend/requirements.txt; then
  MODE="drf"
elif grep -qi "django-ninja" backend/requirements.txt; then
  MODE="ninja"
fi

if [[ -z "${MODE}" ]]; then
  echo "❌ Could not detect API mode (expected django-ninja OR djangorestframework in backend/requirements.txt)"
  exit 1
fi

echo "• Detected backend API mode: ${MODE}"

# Common: Django must be present
if grep -qi "^Django" backend/requirements.txt; then
  echo "✅ requirements: Django"
else
  echo "❌ requirements missing Django"
  exit 1
fi

if [[ "${MODE}" == "ninja" ]]; then
  REQ=(
    "backend/siddes_backend/api.py"
    "backend/siddes_inbox/ninja_router.py"
    "backend/siddes_inbox/store_devnull.py"
  )

  for f in "${REQ[@]}"; do
    if [[ -f "$f" ]]; then
      echo "✅ $f"
    else
      echo "❌ Missing: $f"
      exit 1
    fi
  done

  if grep -qi "django-ninja" backend/requirements.txt; then
    echo "✅ requirements: django-ninja"
  else
    echo "❌ requirements missing django-ninja"
    exit 1
  fi

  if grep -q "api.add_router(\"/inbox\"" backend/siddes_backend/api.py; then
    echo "✅ API root registers /inbox router (Ninja)"
  else
    echo "❌ API root missing inbox router registration (Ninja)"
    exit 1
  fi

  if grep -q "@router.get(\"/threads\"" backend/siddes_inbox/ninja_router.py \
    && grep -q "@router.get(\"/thread/" backend/siddes_inbox/ninja_router.py \
    && grep -q "@router.post(\"/thread/" backend/siddes_inbox/ninja_router.py; then
    echo "✅ inbox router exposes threads + thread read + thread post (Ninja)"
  else
    echo "❌ inbox router missing one or more routes (Ninja)"
    exit 1
  fi

  if grep -q "restricted" backend/siddes_inbox/ninja_router.py \
    && grep -q "restricted" backend/siddes_inbox/endpoint_stub.py; then
    echo "✅ default-safe semantics present (restricted)"
  else
    echo "❌ missing default-safe semantics"
    exit 1
  fi

  echo "✅ Ninja bootstrap check passed"
  exit 0
fi

# DRF mode
REQ=(
  "backend/siddes_backend/api.py"
  "backend/siddes_inbox/urls.py"
  "backend/siddes_inbox/views.py"
  "backend/siddes_inbox/store_devnull.py"
)

for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    exit 1
  fi
done

if grep -qi "django-ninja" backend/requirements.txt; then
  echo "❌ requirements still contain django-ninja (expected removed in DRF mode)"
  exit 1
fi

if grep -qi "djangorestframework" backend/requirements.txt; then
  echo "✅ requirements: djangorestframework"
else
  echo "❌ requirements missing djangorestframework"
  exit 1
fi

if grep -q "\"rest_framework\"" backend/siddes_backend/settings.py; then
  echo "✅ settings: rest_framework installed"
else
  echo "❌ settings missing rest_framework"
  exit 1
fi

if grep -q "include(\"siddes_backend.api\"" backend/siddes_backend/urls.py; then
  echo "✅ urls.py includes siddes_backend.api under /api/"
else
  echo "❌ urls.py does not include siddes_backend.api under /api/"
  exit 1
fi

if grep -q "include(\"siddes_inbox.urls\"" backend/siddes_backend/api.py; then
  echo "✅ api.py includes siddes_inbox.urls under /api/inbox/"
else
  echo "❌ api.py does not include siddes_inbox.urls"
  exit 1
fi

if grep -q "APIView" backend/siddes_inbox/views.py; then
  echo "✅ inbox views look DRF-based (APIView)"
else
  echo "❌ inbox views missing APIView (expected DRF views)"
  exit 1
fi

if grep -q "restricted" backend/siddes_inbox/endpoint_stub.py; then
  echo "✅ default-safe semantics present (restricted)"
else
  echo "❌ missing default-safe semantics"
  exit 1
fi

echo "✅ DRF bootstrap check passed"
