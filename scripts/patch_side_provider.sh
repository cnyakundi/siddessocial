\
#!/usr/bin/env bash
set -euo pipefail

echo "== Patching Next entry file for <AppProviders> =="

# Manual override supported
if [[ -n "${SD_NEXT_ENTRY:-}" ]]; then
  TARGET="${SD_NEXT_ENTRY}"
  if [[ ! -f "${TARGET}" ]]; then
    echo "❌ SD_NEXT_ENTRY points to missing file: ${TARGET}"
    exit 1
  fi
  # infer mode by path
  if [[ "${TARGET}" == *"/app/layout."* ]]; then
    MODE="app"
  elif [[ "${TARGET}" == *"/pages/_app."* ]]; then
    MODE="pages"
  else
    MODE="app"
  fi
  echo "Using SD_NEXT_ENTRY override:"
  echo "  Target: ${TARGET}"
  echo "  Mode:   ${MODE}"
else
  if [[ ! -f "scripts/find_next_entry.py" ]]; then
    echo "❌ scripts/find_next_entry.py not found. Apply sd_002_entry_discovery_unblock first."
    exit 1
  fi
  DETECT="$(python3 scripts/find_next_entry.py || true)"
  if [[ -z "${DETECT}" ]]; then
    echo "❌ Could not detect Next entry file."
    echo "Fix options:"
    echo "  1) Run: find . -name layout.tsx -o -name _app.tsx"
    echo "  2) Then run: SD_NEXT_ENTRY=<path> ./scripts/patch_side_provider.sh"
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
  echo "Auto-detected:"
  echo "  Target: ${TARGET}"
  echo "  Mode:   ${MODE}"
fi

STAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP="${TARGET}.bak.${STAMP}"
echo "Backup: ${BACKUP}"

TARGET="${TARGET}" BACKUP="${BACKUP}" MODE="${MODE}" python3 - <<'PY'
import os, re, sys, pathlib

target = pathlib.Path(os.environ["TARGET"])
backup = pathlib.Path(os.environ["BACKUP"])
mode = os.environ["MODE"]

src = target.read_text(encoding="utf-8")

if "<AppProviders" in src:
    print("✅ Already wired: <AppProviders> found. No changes needed.")
    sys.exit(0)

import_line = 'import { AppProviders } from "@/src/components/AppProviders";'

def ensure_import(s: str) -> str:
    if import_line in s:
        return s
    imports = list(re.finditer(r'^(import .+?;\s*)$', s, flags=re.M))
    if imports:
        last = imports[-1]
        insert_at = last.end()
        return s[:insert_at] + "\n" + import_line + s[insert_at:]
    return import_line + "\n" + s

backup.write_text(src, encoding="utf-8")

if mode == "app":
    s = ensure_import(src)
    m = re.search(r'(<body[^>]*>\s*)([\s\S]*?)(\s*</body>)', s, flags=re.M)
    if not m:
        print("❌ App Router patch failed: <body>...</body> not found. Patch manually.")
        sys.exit(1)
    before, inner, after = m.group(1), m.group(2), m.group(3)
    wrapped = before + "<AppProviders>\n" + inner.strip() + "\n</AppProviders>" + after
    out = s[:m.start()] + wrapped + s[m.end():]
elif mode == "pages":
    s = ensure_import(src)
    # Try return (...) first
    m = re.search(r'return\s*\(\s*([\s\S]*?)\s*\)\s*;?', s, flags=re.M)
    if m:
        inner = m.group(1).strip()
        out = s[:m.start(1)] + "<AppProviders>\n" + inner + "\n</AppProviders>" + s[m.end(1):]
    else:
        # Try simple return <...>;
        m2 = re.search(r'return\s+<', s)
        if not m2:
            print("❌ Pages Router patch failed: couldn't find a return JSX block. Patch manually.")
            sys.exit(1)
        s2 = re.sub(r'return\s+', 'return (\n<AppProviders>\n', s, count=1)
        s2 = re.sub(r';\s*$', '\n</AppProviders>\n);\n', s2, count=1, flags=re.M)
        out = s2
else:
    print("❌ Unknown MODE:", mode)
    sys.exit(1)

target.write_text(out, encoding="utf-8")
print("✅ Patched successfully.")
PY

echo "✅ Done. Now run:"
echo "  ./scripts/run_tests.sh"
