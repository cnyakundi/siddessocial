#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox backend does not trust viewer query param =="

VIEWS="backend/siddes_inbox/views.py"
DOC="docs/INBOX_BACKEND_CONTRACT.md"
DBG="frontend/src/components/InboxStubDebugPanel.tsx"

if [[ ! -f "${VIEWS}" ]]; then
  echo "❌ Missing: ${VIEWS}"
  exit 1
fi

if ! grep -q "x-sd-viewer" "${VIEWS}"; then
  echo "❌ ${VIEWS} must reference x-sd-viewer header"
  exit 1
fi

if ! grep -q "sd_viewer" "${VIEWS}"; then
  echo "❌ ${VIEWS} must reference sd_viewer cookie"
  exit 1
fi

if grep -q "query_params.get(\"viewer\"" "${VIEWS}"; then
  echo "❌ ${VIEWS} still reads viewer from query params"
  exit 1
fi

if [[ -f "${DBG}" ]]; then
  if grep -q "set(\"viewer\"" "${DBG}"; then
    echo "❌ ${DBG} should not append viewer to request URLs (use header/cookie)"
    exit 1
  fi
fi

if [[ ! -f "${DOC}" ]]; then
  echo "❌ Missing: ${DOC}"
  exit 1
fi

# Contract doc should explicitly mention deprecation.
if ! grep -iE -q "viewer.*deprecated" "${DOC}"; then
  echo "❌ ${DOC} should mention viewer query param deprecation"
  exit 1
fi

echo "✅ viewer query param is deprecated/ignored (header/cookie only)"
