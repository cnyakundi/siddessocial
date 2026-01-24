#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Siddes terminology guard (sd_156) =="

python3 - <<'PY'
from __future__ import annotations
from pathlib import Path
import re
import sys

SRC = Path("frontend/src")
if not SRC.exists():
    print("❌ Missing frontend/src")
    sys.exit(1)

# Internal implementation details that may contain "channel" tokens by design:
SKIP = {
    "frontend/src/lib/chips.ts",
    "frontend/src/lib/publicChannels.ts",
    "frontend/src/lib/mockFeed.ts",
}

# Scan string literals only (heuristic) to avoid identifiers like publicChannel.
# Use triple-quoted RAW regex so quotes don't break parsing.
STRING_RE = re.compile(r"""(["'`])((?:\.|(?!\1).)*?)\1""", re.DOTALL)


SIDER_RE = re.compile(r"\bsiders?\b", re.IGNORECASE)

FORBIDDEN = [
    "followers",
    "following",
    "follower",
    "followed",
    "follow",
    "unfollow",
    "channel",
    "channels",
    "circles",
    "stories",
    "rings",
]

bad = []

for p in SRC.rglob("*"):
    if p.is_dir():
        continue
    if p.suffix not in {".ts", ".tsx"}:
        continue

    rel = p.as_posix()
    if rel in SKIP:
        continue

    txt = p.read_text(encoding="utf-8", errors="ignore")
    for m in STRING_RE.finditer(txt):
        s = m.group(2)
        low = s.lower()

        # For "sider(s)", only enforce on human-visible strings (not module specifiers or paths)
        s_stripped = s.strip()
        if not (
            s_stripped.startswith("/")
            or s_stripped.startswith("./")
            or s_stripped.startswith("../")
            or s_stripped.startswith("@/")
        ):
            if SIDER_RE.search(s):
                bad.append((rel, "sider(s)", (s[:140].replace("\n", " ").replace("\r", " "))))
                continue

        for w in FORBIDDEN:
            if w in low:
                bad.append((rel, w, (s[:140].replace("\n", " ").replace("\r", " "))))
                break

if bad:
    print("❌ Forbidden terminology found in UI strings:")
    for fp, w, snip in bad[:50]:
        print(f" - {fp}: contains '{w}' in string: {snip!r}")
    if len(bad) > 50:
        print(f" ... and {len(bad)-50} more.")
    sys.exit(1)

print("✅ terminology guard passed (no forbidden UI strings)")
PY
