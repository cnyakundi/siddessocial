#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox Django app scaffold =="

REQ=(
  "backend/siddes_inbox/__init__.py"
  "backend/siddes_inbox/models_stub.py"
  "backend/siddes_inbox/store.py"
  "backend/siddes_inbox/endpoint_stub.py"
  "backend/siddes_inbox/django_ninja_template.py"
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

# Quick content checks (ensure we mirrored the contract names)
if grep -q "class ThreadRecord" backend/siddes_inbox/models_stub.py && grep -q "class MessageRecord" backend/siddes_inbox/models_stub.py; then
  echo "✅ models_stub has ThreadRecord + MessageRecord"
else
  echo "❌ models_stub missing ThreadRecord/MessageRecord"
  exit 1
fi

if grep -q "def list_threads" backend/siddes_inbox/endpoint_stub.py && grep -q "restricted" backend/siddes_inbox/endpoint_stub.py; then
  echo "✅ endpoint_stub exposes list_threads and is default-safe (restricted)"
else
  echo "❌ endpoint_stub missing list_threads or restricted semantics"
  exit 1
fi

python3 -m py_compile \
  backend/siddes_inbox/__init__.py \
  backend/siddes_inbox/models_stub.py \
  backend/siddes_inbox/store.py \
  backend/siddes_inbox/endpoint_stub.py

echo "✅ inbox django scaffold check passed"
