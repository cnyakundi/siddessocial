#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Invites scaffold =="

missing=0

check_file() {
  local p="$1"
  if [[ -f "${p}" ]]; then
    echo "✅ ${p}"
  else
    echo "❌ Missing: ${p}"
    missing=1
  fi
}

grep_req() {
  local p="$1"
  local pat="$2"
  if grep -q "${pat}" "${p}" 2>/dev/null; then
    echo "✅ ${p} contains ${pat}"
  else
    echo "❌ ${p} missing token: ${pat}"
    missing=1
  fi
}

# Backend (Django)
check_file "backend/siddes_invites/__init__.py"
check_file "backend/siddes_invites/apps.py"
check_file "backend/siddes_invites/models.py"
check_file "backend/siddes_invites/store_db.py"
check_file "backend/siddes_invites/views.py"
check_file "backend/siddes_invites/urls.py"
check_file "backend/siddes_invites/migrations/0001_initial.py"

grep_req "backend/siddes_backend/settings.py" "siddes_invites.apps.SiddesInvitesConfig"
grep_req "backend/siddes_backend/api.py" "siddes_invites.urls"

echo ""

# Frontend stubs + providers
check_file "frontend/src/lib/inviteProvider.ts"
check_file "frontend/src/lib/inviteProviders/mock.ts"
check_file "frontend/src/lib/inviteProviders/backendStub.ts"
check_file "frontend/src/lib/server/invitesStore.ts"
check_file "frontend/src/app/api/invites/route.ts"
check_file "frontend/src/app/api/invites/[id]/route.ts"
check_file "frontend/src/app/invite/[id]/page.tsx"

grep_req "frontend/src/app/api/invites/route.ts" "resolveStubViewer"
grep_req "frontend/src/app/api/invites/[id]/route.ts" "resolveStubViewer"

echo ""

if [[ "${missing}" -eq 0 ]]; then
  echo "✅ Invites scaffold present"
else
  echo ""
  echo "Fix: apply sd_138a invites scaffold overlay"
  exit 1
fi
