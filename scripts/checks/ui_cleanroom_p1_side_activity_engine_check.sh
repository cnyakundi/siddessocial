#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== ui_cleanroom_p1_side_activity_engine_check =="

must_exist() {
  local p="$1"
  if [[ ! -e "${p}" ]]; then
    echo "❌ missing: ${p}" >&2
    exit 1
  fi
}

must_contain() {
  local p="$1"; local needle="$2"
  if ! grep -qF "${needle}" "${p}"; then
    echo "❌ expected '${needle}' in: ${p}" >&2
    exit 1
  fi
}

must_not_contain() {
  local p="$1"; local needle="$2"
  if grep -qF "${needle}" "${p}"; then
    echo "❌ forbidden '${needle}' in: ${p}" >&2
    exit 1
  fi
}

must_exist "frontend/src/hooks/useSideActivity.ts"

must_exist "frontend/src/lib/sideActivity.ts"
must_contain "frontend/src/lib/sideActivity.ts" "startSideActivityEngine"
must_contain "frontend/src/lib/sideActivity.ts" "subscribeSideActivity"

# No per-component polling loops for activity
FILES=(
  "frontend/src/components/AppTopBar.tsx"
  "frontend/src/components/DesktopTopBar.tsx"
  "frontend/src/components/SideChrome.tsx"
  "frontend/src/components/DesktopSideRail.tsx"
)

for f in "${FILES[@]}"; do
  must_exist "${f}"
  must_not_contain "${f}" "setInterval"
  must_not_contain "${f}" "refreshSideActivityMap"
  must_not_contain "${f}" "getSideActivityMap"
done

echo "✅ ui_cleanroom_p1_side_activity_engine_check passed"
