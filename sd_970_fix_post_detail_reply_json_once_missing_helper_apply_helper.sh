#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_970_fix_post_detail_reply_json_once_missing_helper"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-post/[id]/page.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# 1) Insert helper after the last import if missing
if "__sd_read_reply_json_once" not in s:
    helper = """
// sd_970: read reply JSON only once (safe parse)
async function __sd_read_reply_json_once(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

"""
    # find end of last import block
    imports = list(re.finditer(r"^import .*?;\s*$", s, flags=re.M))
    if not imports:
        raise SystemExit("ERROR: Could not find import block to insert helper after.")
    insert_at = imports[-1].end()
    s = s[:insert_at] + helper + s[insert_at:]

# 2) Fix calls that currently use empty parens: __sd_read_reply_json_once()
# Replace ONLY empty-paren calls with __sd_read_reply_json_once(res)
s = re.sub(r"__sd_read_reply_json_once\(\s*\)", "__sd_read_reply_json_once(res)", s)

# Marker
if "sd_970_fix_post_detail_reply_json_once_missing_helper" not in s:
    s += "\n\n// sd_970_fix_post_detail_reply_json_once_missing_helper\n"

p.write_text(s, encoding="utf-8")
print("✅ Patched:", str(p))
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}/${FILE}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
