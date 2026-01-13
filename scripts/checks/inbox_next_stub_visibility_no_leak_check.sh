#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Next.js inbox stub routes are default-safe (no leak) =="

HELPER="frontend/src/lib/server/inboxViewer.ts"
DOC="docs/INBOX_VISIBILITY_STUB.md"

FILES=(
  "frontend/src/app/api/inbox/threads/route.ts"
  "frontend/src/app/api/inbox/thread/[id]/route.ts"
  "frontend/src/app/api/inbox/debug/incoming/route.ts"
  "frontend/src/app/api/inbox/debug/unread/reset/route.ts"
)

missing=0
if [[ -f "${HELPER}" ]]; then
  echo "✅ ${HELPER}"
else
  echo "❌ Missing: ${HELPER}"
  missing=1
fi

for f in "${FILES[@]}"; do
  if [[ -f "${f}" ]]; then
    echo "✅ ${f}"
  else
    echo "❌ Missing: ${f}"
    missing=1
  fi

done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

echo ""

echo "-- No viewer identity from URLs --"
for f in "${FILES[@]}"; do
  if grep -q "searchParams.get(\"viewer\"" "${f}"; then
    echo "❌ ${f} still reads viewer from query params"
    exit 1
  fi

done

echo "✅ No route reads viewer from query params"

echo ""

echo "-- Helper must disable stub viewer in production --"
if ! grep -q "NODE_ENV" "${HELPER}"; then
  echo "❌ ${HELPER} must reference NODE_ENV to disable stubs in production"
  exit 1
fi
if ! grep -q "production" "${HELPER}"; then
  echo "❌ ${HELPER} must treat production as restricted"
  exit 1
fi

echo "✅ Production safety gate present"

echo ""

echo "-- Routes must use resolveStubViewer + default-safe restricted branch --"
for f in "${FILES[@]}"; do
  if ! grep -q "resolveStubViewer" "${f}"; then
    echo "❌ ${f} must use resolveStubViewer"
    exit 1
  fi

done

# Ensure core routes have a missing-viewer restricted return.
if ! grep -q "restricted: true" "frontend/src/app/api/inbox/threads/route.ts"; then
  echo "❌ threads stub must return restricted=true on missing viewer"
  exit 1
fi
if ! grep -q "restricted: true" "frontend/src/app/api/inbox/thread/[id]/route.ts"; then
  echo "❌ thread stub must return restricted=true on missing viewer"
  exit 1
fi

echo "✅ Default-safe restricted branches present"

echo ""

echo "-- Doc should state header/cookie only and viewer param ignored --"
if [[ ! -f "${DOC}" ]]; then
  echo "❌ Missing: ${DOC}"
  exit 1
fi

if ! grep -q "x-sd-viewer" "${DOC}"; then
  echo "❌ ${DOC} must mention x-sd-viewer"
  exit 1
fi
if ! grep -q "sd_viewer" "${DOC}"; then
  echo "❌ ${DOC} must mention sd_viewer"
  exit 1
fi
if ! grep -q "\?viewer" "${DOC}"; then
  echo "❌ ${DOC} must mention ?viewer is ignored"
  exit 1
fi

echo "✅ Docs in sync"

echo ""
echo "✅ Next.js inbox stub routes are default-safe"
