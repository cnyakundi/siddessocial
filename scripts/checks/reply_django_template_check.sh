#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Reply Django route templates =="

REQ=(
  "backend/siddes_reply/django_ninja_template.py"
  "backend/siddes_reply/drf_template.py"
  "docs/REPLY_DJANGO_WIRING.md"
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

if grep -q "create_reply" "backend/siddes_reply/django_ninja_template.py" && grep -q "hide_existence" "backend/siddes_reply/django_ninja_template.py"; then
  echo "✅ Ninja template references create_reply + hide_existence"
else
  echo "❌ Ninja template missing required references"
  exit 1
fi

if grep -q "create_reply" "backend/siddes_reply/drf_template.py"; then
  echo "✅ DRF template references create_reply"
else
  echo "❌ DRF template missing required references"
  exit 1
fi
