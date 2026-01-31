#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_968_post_detail_hooks_safe"
PAGE="frontend/src/app/siddes-post/[id]/page.tsx"

if [ ! -f "$PAGE" ]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$PAGE")"
cp -a "$PAGE" "$BK/$PAGE"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("frontend/src/app/siddes-post/[id]/page.tsx")
s = path.read_text(encoding="utf-8")
orig = s

if "sd_968_post_detail_hooks_safe" in s:
    print("ℹ️ sd_968 already applied; no changes made.")
    raise SystemExit(0)

# --- 1) Remove any existing replyInputRef declarations (we will re-insert in the right place)
s = re.sub(
    r"\n\s*const\s+replyInputRef\s*=\s*React\.useRef[^;]*;\s*\n",
    "\n",
    s,
    flags=re.M,
)

# --- 2) Remove any existing useEffect block that references shouldOpenReply(sp) (we will re-insert hooks-safe)
# This matches: useEffect(() => { ... shouldOpenReply(sp) ... }, [sp]);
s = re.sub(
    r"\n\s*useEffect\(\(\)\s*=>\s*\{[\s\S]*?shouldOpenReply\(\s*sp\s*\)[\s\S]*?\}\s*,\s*\[sp\]\s*\);\s*\n",
    "\n",
    s,
    flags=re.M,
)

# --- 3) Insert replyInputRef right after replyTo state (fallback: after replyText state)
insert_ref = "\n  const replyInputRef = React.useRef<HTMLTextAreaElement | null>(null);\n"

m = re.search(r"^\s*const\s+\[replyTo,\s*setReplyTo\][^\n]*\n", s, flags=re.M)
if m:
    pos = m.end()
else:
    m2 = re.search(r"^\s*const\s+\[replyText,\s*setReplyText\][^\n]*\n", s, flags=re.M)
    if not m2:
        raise SystemExit("ERROR: Could not find replyText/replyTo state to anchor replyInputRef insertion.")
    pos = m2.end()

# Only insert if not already present
if "const replyInputRef = React.useRef" not in s:
    s = s[:pos] + insert_ref + s[pos:]

# --- 4) Insert the ?reply=1 focus effect after the queuedCount effect (best anchor),
# fallback: insert right after replyInputRef declaration block.
focus_effect = """
  // sd_968: Focus the sticky composer when opened via ?reply=1 (hooks-safe: hook is unconditional).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldOpenReply(sp)) return;
    window.setTimeout(() => {
      try {
        replyInputRef.current?.focus();
      } catch {
        // ignore
      }
    }, 50);
  }, [sp]);
"""

# Find the queuedCount useEffect block by looking for countQueuedRepliesForPost(id) then the closing }, [id]);
idx = s.find("countQueuedRepliesForPost(id)")
inserted = False
if idx >= 0:
    end = s.find("}, [id]);", idx)
    if end >= 0:
        end += len("}, [id]);")
        s = s[:end] + "\n" + focus_effect + "\n" + s[end:]
        inserted = True

if not inserted:
    # Fallback: insert after replyInputRef declaration line
    m3 = re.search(r"^\s*const\s+replyInputRef\s*=\s*React\.useRef[^\n]*\n", s, flags=re.M)
    if not m3:
        raise SystemExit("ERROR: Could not locate replyInputRef line for fallback insertion.")
    s = s[:m3.end()] + focus_effect + "\n" + s[m3.end():]

# Marker
s += "\n\n// sd_968_post_detail_hooks_safe\n"

path.write_text(s, encoding="utf-8")
print("✅ Patched:", str(path))
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}"
echo ""
echo "Next:"
echo "  cd /Users/cn/Downloads/sidesroot/frontend && npm run typecheck && npm run build"
echo "  cd /Users/cn/Downloads/sidesroot && bash scripts/run_tests.sh --smoke"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$PAGE\" \"$PAGE\""
