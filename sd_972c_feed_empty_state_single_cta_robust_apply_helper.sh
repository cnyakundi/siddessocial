#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_972c_feed_empty_state_single_cta_robust"
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
text = p.read_text(encoding="utf-8")
orig = text

MARK = "sd_972c_feed_empty_state_single_cta_robust"

def find_matching_curly(s: str, open_i: int) -> int:
    n = len(s)
    depth = 0
    i = open_i
    in_s = in_d = in_t = False
    esc = False
    in_line = False
    in_block = False
    while i < n:
        ch = s[i]

        if in_line:
            if ch == "\n": in_line = False
            i += 1; continue
        if in_block:
            if ch == "*" and i + 1 < n and s[i+1] == "/":
                in_block = False; i += 2; continue
            i += 1; continue

        if in_s:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == "'": in_s = False
            i += 1; continue
        if in_d:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_d = False
            i += 1; continue
        if in_t:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == "`": in_t = False
            i += 1; continue

        if ch == "/" and i + 1 < n:
            nxt = s[i+1]
            if nxt == "/": in_line = True; i += 2; continue
            if nxt == "*": in_block = True; i += 2; continue

        if ch == "'": in_s = True; i += 1; continue
        if ch == '"': in_d = True; i += 1; continue
        if ch == "`": in_t = True; i += 1; continue

        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return i
        i += 1
    return -1

def find_function_block(s: str) -> tuple[int,int] | None:
    # Try function EmptyState(...) { ... }
    m = re.search(r'\bfunction\s+EmptyState\s*\(', s)
    if m:
        brace = s.find("{", m.end())
        if brace != -1:
            end = find_matching_curly(s, brace)
            if end != -1:
                return brace, end
    # Try const EmptyState = (...) => { ... }
    m = re.search(r'\bconst\s+EmptyState\b', s)
    if m:
        arrow = s.find("=>", m.end())
        if arrow != -1:
            brace = s.find("{", arrow)
            if brace != -1:
                end = find_matching_curly(s, brace)
                if end != -1:
                    return brace, end
    return None

def remove_cta_inside_block(block: str) -> tuple[str,int]:
    # Remove any JSX expression or button containing these labels
    labels = ["Create Circle", "Create Set", "New Circle"]
    hits = 0
    low = block.lower()
    for lab in labels:
        target = lab.lower()
        while True:
            i = low.find(target)
            if i == -1:
                break

            # Prefer removing surrounding {...} expression containing the label
            open_i = block.rfind("{", 0, i)
            if open_i != -1:
                close_i = find_matching_curly(block, open_i)
                if close_i != -1 and open_i < i < close_i:
                    expr = block[open_i:close_i+1]
                    if target in expr.lower():
                        block = block[:open_i] + "\n" + block[close_i+1:]
                        low = block.lower()
                        hits += 1
                        continue

            # Fallback: remove the nearest <button ...>...</button>
            b0 = block.rfind("<button", 0, i)
            b1 = block.find("</button>", i)
            if b0 != -1 and b1 != -1:
                b1 += len("</button>")
                block = block[:b0] + "\n" + block[b1:]
                low = block.lower()
                hits += 1
                continue

            # If we couldn't remove, skip this occurrence
            low = low[i+len(target):]
            break

    return block, hits

def remove_jsx_prop(s: str, prop: str) -> str:
    # Remove prop={ ... } occurrences (best-effort, safe)
    pat = prop + "={"
    while True:
        idx = s.find(pat)
        if idx == -1:
            return s
        start = idx
        while start > 0 and s[start-1] in " \t":
            start -= 1
        if start > 0 and s[start-1] == "\n":
            start -= 1
        open_brace = s.find("{", idx)
        end_brace = find_matching_curly(s, open_brace)
        if end_brace == -1:
            return s
        s = s[:start] + s[end_brace+1:]
    return s

fb = find_function_block(text)
if not fb:
    raise SystemExit("ERROR: Could not locate EmptyState() block in SideFeed.tsx")

b0, b1 = fb
block = text[b0:b1+1]

block2, hits = remove_cta_inside_block(block)
if hits == 0:
    raise SystemExit("ERROR: I found EmptyState, but could not find any 'Create Circle/Set/New Circle' CTA inside it.")

# Also scrub onCreateSet/onCreateCircle tokens inside the block (best-effort)
block2 = block2.replace("onCreateSet", "")
block2 = block2.replace("onCreateCircle", "")

text = text[:b0] + block2 + text[b1+1:]

# Remove any props passed to EmptyState call
text = remove_jsx_prop(text, "onCreateSet")
text = remove_jsx_prop(text, "onCreateCircle")

# Marker
if '"use client";' in text and MARK not in text:
    text = text.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(text, encoding="utf-8")
print("PATCHED:", str(p), "| removed CTA blocks:", hits)
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove secondary Create Circle/Set CTA; keep single primary action; creation stays in Circle picker / Circles page.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
