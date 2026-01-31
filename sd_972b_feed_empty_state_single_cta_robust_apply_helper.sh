#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_972b_feed_empty_state_single_cta_robust"
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

MARK = "sd_972b_feed_empty_state_single_cta_robust"

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
            if ch == "\n":
                in_line = False
            i += 1
            continue

        if in_block:
            if ch == "*" and i + 1 < n and s[i + 1] == "/":
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

        if ch == "/" and i + 1 < n:
            nxt = s[i + 1]
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

def remove_jsx_prop(s: str, prop: str) -> str:
    key = prop + "={"
    while True:
        idx = s.find(key)
        if idx == -1:
            return s
        start = idx
        while start > 0 and s[start - 1] in " \t":
            start -= 1
        if start > 0 and s[start - 1] == "\n":
            start -= 1

        open_brace = s.find("{", idx)
        end_brace = find_matching_curly(s, open_brace)
        if end_brace == -1:
            return s
        s = s[:start] + s[end_brace + 1 :]
    return s

def remove_button_by_label(s: str, label: str) -> tuple[str, int]:
    hits = 0
    low = s.lower()
    target = label.lower()
    pos = 0
    while True:
        i = low.find(target, pos)
        if i == -1:
            break

        # Prefer removing the entire surrounding { ... } expression if it exists
        window_start = max(0, i - 1200)
        chunk = s[window_start:i]

        j = chunk.rfind("{side")
        if j == -1:
            j = chunk.rfind("{")
        if j != -1:
            open_i = window_start + j
            close_i = find_matching_curly(s, open_i)
            if close_i != -1 and open_i < i < close_i:
                before = s[:open_i].rstrip()
                after = s[close_i + 1 :].lstrip()
                s = before + "\n" + after
                low = s.lower()
                hits += 1
                pos = 0
                continue

        # Fallback: remove the <button ...>...</button> containing the label
        btn_start = s.rfind("<button", 0, i)
        btn_end = s.find("</button>", i)
        if btn_start != -1 and btn_end != -1:
            btn_end += len("</button>")
            before = s[:btn_start].rstrip()
            after = s[btn_end:].lstrip()
            s = before + "\n" + after
            low = s.lower()
            hits += 1
            pos = 0
            continue

        pos = i + len(target)

    return s, hits

# 1) Remove the Create Circle CTA block (or New Circle if you renamed it)
text, removed_create = remove_button_by_label(text, "Create Circle")
if removed_create == 0:
    text, removed_new = remove_button_by_label(text, "New Circle")
else:
    removed_new = 0

# 2) Remove any props passed into EmptyState for create circle
text = remove_jsx_prop(text, "onCreateSet")
text = remove_jsx_prop(text, "onCreateCircle")

# 3) Remove onCreateSet/onCreateCircle tokens from EmptyState destructure (best-effort)
for tok in ["onCreateSet", "onCreateCircle"]:
    text = re.sub(rf"\b{tok}\s*,\s*", "", text)
    text = re.sub(rf",\s*\b{tok}\b", "", text)

# 4) Remove type fields for these props (best-effort)
text = re.sub(r"\s*onCreate(Set|Circle)\?\s*:\s*\(\)\s*=>\s*void;\s*\n?", "", text)

# Marker at top
if '"use client";' in text and MARK not in text:
    text = text.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

if text == orig:
    raise SystemExit("ERROR: No changes made. I couldn't find 'Create Circle' or 'New Circle' in SideFeed.tsx.")
else:
    p.write_text(text, encoding="utf-8")
    print("PATCHED:", str(p))
    print("Removed blocks:", {"Create Circle": removed_create, "New Circle": removed_new})
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove secondary 'Create Circle' CTA; keep single primary action; circle creation stays in Circle picker / Circles page.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Open /siddes-feed on Friends/Close/Work with 0 posts"
echo "  - You should see ONLY one CTA (New Post / Sign in), no Create/New Circle button"
