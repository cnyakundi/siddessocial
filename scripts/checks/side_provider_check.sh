\
#!/usr/bin/env bash
set -euo pipefail

echo "== Check: SideProvider wired into Next entry file =="

REQ_FILES=(
  "frontend/src/components/AppProviders.tsx"
  "frontend/src/components/SideProvider.tsx"
  "frontend/src/components/SideBadge.tsx"
  "frontend/src/components/SideChrome.tsx"
  "frontend/src/lib/sides.ts"
  "frontend/src/lib/sideStore.ts"
  "scripts/find_next_entry.py"
)

missing=0
for f in "${REQ_FILES[@]}"; do
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

DETECT="$(python3 scripts/find_next_entry.py || true)"
if [[ -z "${DETECT}" ]]; then
  echo "❌ Could not auto-detect Next entry file."
  echo "Fix:"
  echo "  SD_NEXT_ENTRY=<path> ./scripts/patch_side_provider.sh"
  exit 1
fi

MODE="$(python3 - <<PY
import json
d=json.loads('''${DETECT}''')
print(d['mode'])
PY)"
TARGET="$(python3 - <<PY
import json
d=json.loads('''${DETECT}''')
print(d['path'])
PY)"

echo "Entry: ${TARGET} (mode=${MODE})"

if grep -q "<AppProviders" "${TARGET}"; then
  echo "✅ Entry is wrapped with <AppProviders>"
else
  echo "❌ Entry not wrapped with <AppProviders> yet."
  echo "Fix:"
  echo "  ./scripts/patch_side_provider.sh"
  exit 1
fi
