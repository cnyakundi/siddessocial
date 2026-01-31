#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_955_feed_empty_state_single_cta_v2"
FILE="frontend/src/components/SideFeed.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$FILE" "$BK/SideFeed.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")
orig = s

MARK = "sd_955_feed_empty_state_single_cta_v2"
if MARK in s:
    print("SKIP: sd_955 already applied.")
    raise SystemExit(0)

def find_matching_curly(text: str, open_i: int) -> int:
    # Finds matching } for a { at open_i, respecting strings and comments.
    n = len(text)
    depth = 0
    i = open_i
    in_s = in_d = in_t = False
    esc = False
    in_line = False
    in_block = False

    while i < n:
        ch = text[i]

        if in_line:
            if ch == "\n":
                in_line = False
            i += 1
            continue

        if in_block:
            if ch == "*" and i + 1 < n and text[i + 1] == "/":
                in_block = False
                i += 2
                continue
            i += 1
            continue

        if in_s:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "'":
                in_s = False
            i += 1
            continue

        if in_d:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_d = False
            i += 1
            continue

        if in_t:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "`":
                in_t = False
            i += 1
            continue

        # not in string/comment
        if ch == "/" and i + 1 < n:
            nxt = text[i + 1]
            if nxt == "/":
                in_line = True
                i += 2
                continue
            if nxt == "*":
                in_block = True
                i += 2
                continue

        if ch == "'":
            in_s = True
            i += 1
            continue
        if ch == '"':
            in_d = True
            i += 1
            continue
        if ch == "`":
            in_t = True
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i

        i += 1

    return -1

def remove_jsx_prop(text: str, prop: str) -> str:
    key = prop + "={"
    while True:
        idx = text.find(key)
        if idx == -1:
            return text
        # remove leading whitespace before prop
        start = idx
        while start > 0 and text[start - 1] in " \t":
            start -= 1
        if start > 0 and text[start - 1] == "\n":
            start -= 1

        open_brace = text.find("{", idx)
        end_brace = find_matching_curly(text, open_brace)
        if end_brace == -1:
            # don't risk corrupting file
            return text

        # Remove from start..end_brace+1
        text = text[:start] + text[end_brace + 1 :]
    return text

def remove_create_circle_block(text: str) -> tuple[str, int]:
    # Remove the whole {side ...} JSX expression that contains "Create Circle"
    hits = 0
    pos = 0
    low = text.lower()
    target = "create circle"
    while True:
        i = low.find(target, pos)
        if i == -1:
            break

        # Look back for a `{side` expression start near this location
        window_start = max(0, i - 800)
        chunk = text[window_start:i]
        # Prefer the last occurrence of "{side" in this window
        j = chunk.rfind("{side")
        if j == -1:
            # fallback: last "{"
            j = chunk.rfind("{")
            if j == -1:
                pos = i + len(target)
                continue

        open_i = window_start + j
        close_i = find_matching_curly(text, open_i)
        if close_i == -1:
            pos = i + len(target)
            continue

        # Delete the block and surrounding whitespace/newline
        before = text[:open_i]
        after = text[close_i + 1 :]
        # Trim one extra blank line if we created it
        text = before.rstrip() + "\n" + after.lstrip()
        low = text.lower()
        hits += 1
        pos = 0  # restart scan because indices changed

    return text, hits

# 1) Remove Create Circle CTA block(s)
s, removed_blocks = remove_create_circle_block(s)

# 2) Remove onCreateSet/onCreateCircle props if present
s = remove_jsx_prop(s, "onCreateSet")
s = remove_jsx_prop(s, "onCreateCircle")

# 3) If EmptyState signature destructures onCreateSet/onCreateCircle, remove tokens (best-effort)
m = re.search(r"function\s+EmptyState\s*\(\s*\{", s)
if m:
    start = s.find("{", m.start())
    end = find_matching_curly(s, start)
    if end != -1 and end > start:
        inner = s[start+1:end]
        inner2 = inner
        for tok in ["onCreateSet", "onCreateCircle"]:
            inner2 = re.sub(rf"\b{tok}\s*,\s*", "", inner2)
            inner2 = re.sub(rf",\s*\b{tok}\b", "", inner2)
            inner2 = re.sub(rf"\b{tok}\b", "", inner2)
        if inner2 != inner:
            s = s[:start+1] + inner2 + s[end:]

# 4) Remove onCreateSet/onCreateCircle fields from inline type objects (best-effort)
s = re.sub(r"\s*onCreate(Set|Circle)\?\s*:\s*\(\)\s*=>\s*void;\s*\n?", "", s)

# marker
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

if s == orig:
    print("NO CHANGE: nothing matched (maybe Create Circle CTA already gone).")
else:
    p.write_text(s, encoding="utf-8")
    print("PATCHED:", str(p))
    print("Removed Create Circle blocks:", removed_blocks)
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove 'Create Circle' CTA; keep single primary action; circle creation lives in Circle picker / Circles page.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
