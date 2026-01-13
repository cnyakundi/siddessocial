#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox Django in-memory store seed (sd_109+) =="

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

if [[ "${MODE}" == "ninja" ]]; then
  REQ=(
    "backend/siddes_inbox/store_memory.py"
    "backend/siddes_inbox/ninja_router.py"
    "backend/siddes_inbox/endpoint_stub.py"
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

  if grep -q "InMemoryInboxStore" backend/siddes_inbox/ninja_router.py; then
    echo "✅ ninja_router uses InMemoryInboxStore"
  else
    echo "❌ ninja_router does not reference InMemoryInboxStore"
    exit 1
  fi

  if grep -q "store\.list_threads" backend/siddes_inbox/endpoint_stub.py \
    && grep -q "store\.get_thread" backend/siddes_inbox/endpoint_stub.py \
    && grep -q "store\.send_message" backend/siddes_inbox/endpoint_stub.py; then
    echo "✅ endpoint layer delegates to store"
  else
    echo "❌ endpoint layer does not delegate to store"
    exit 1
  fi

  if grep -q '"restricted": True' backend/siddes_inbox/endpoint_stub.py; then
    echo "✅ restricted responses preserved"
  else
    echo "❌ restricted responses missing"
    exit 1
  fi

  echo "✅ sd_109+ Ninja seed check passed"
  exit 0
fi

# DRF mode
REQ=(
  "backend/siddes_inbox/store_memory.py"
  "backend/siddes_inbox/urls.py"
  "backend/siddes_inbox/views.py"
  "backend/siddes_inbox/endpoint_stub.py"
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

if grep -q "InMemoryInboxStore" backend/siddes_inbox/views.py && grep -q "seed_demo" backend/siddes_inbox/views.py; then
  echo "✅ DRF views seed InMemoryInboxStore demo content"
else
  echo "❌ DRF views do not appear to seed InMemoryInboxStore"
  exit 1
fi

if grep -q "store\.list_threads" backend/siddes_inbox/endpoint_stub.py \
  && grep -q "store\.get_thread" backend/siddes_inbox/endpoint_stub.py \
  && grep -q "store\.send_message" backend/siddes_inbox/endpoint_stub.py; then
  echo "✅ endpoint layer delegates to store"
else
  echo "❌ endpoint layer does not delegate to store"
  exit 1
fi

if grep -q '"restricted": True' backend/siddes_inbox/endpoint_stub.py; then
  echo "✅ restricted responses preserved"
else
  echo "❌ restricted responses missing"
  exit 1
fi

echo "✅ sd_109+ DRF seed check passed"
