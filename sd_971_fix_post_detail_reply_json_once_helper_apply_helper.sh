#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_971_fix_post_detail_reply_json_once_helper"
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

# 1) Insert helper if missing
has_helper = bool(re.search(r"(WeakMap<Response|function\s+__sd_read_reply_json_once)", s))
if not has_helper:
    helper = """
// sd_971: read reply JSON only once (Response body can be consumed once).
const __sd_reply_json_cache = new WeakMap<Response, any | null>();
async function __sd_read_reply_json_once(res: Response): Promise<any | null> {
  if (__sd_reply_json_cache.has(res)) return __sd_reply_json_cache.get(res) ?? null;
  const val = await res.json().catch(() => null);
  __sd_reply_json_cache.set(res, val);
  return val;
}

"""
    imports = list(re.finditer(r"^import .*?;\s*$", s, flags=re.M))
    if not imports:
        raise SystemExit("ERROR: Could not find import block to insert helper after.")
    insert_at = imports[-1].end()
    s = s[:insert_at] + helper + s[insert_at:]

# 2) Fix empty-paren calls -> pass `res`
s = re.sub(r"__sd_read_reply_json_once\s*\(\s*\)", "__sd_read_reply_json_once(res)", s)

if "sd_971_fix_post_detail_reply_json_once_helper" not in s:
    s += "\n\n// sd_971_fix_post_detail_reply_json_once_helper\n"

p.write_text(s, encoding="utf-8")
print("✅ Patched:", str(p))
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}/${FILE}"
echo ""
echo "Next:"
echo "  cd /Users/cn/Downloads/sidesroot/frontend && npm run typecheck && npm run build"
echo "  cd /Users/cn/Downloads/sidesroot && bash scripts/run_tests.sh --smoke"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
