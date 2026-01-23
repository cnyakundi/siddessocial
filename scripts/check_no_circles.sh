#!/usr/bin/env bash
set -euo pipefail

# Fails if banned "circle" phrasing returns in USER-FACING copy or API strings.
# Intentional: does NOT flag identifiers like MessageCircle / CheckCircle2 / radial-gradient(circle...).

ROOT="$(pwd)"
TARGETS=("frontend/src" "backend")
BANNED=(
  "inner circle"
  "bring your circle"
  "smaller circles"
  "circle health"
  "circles inside a side"
)

python3 - <<'PY'
import os, re, sys

targets = ["frontend/src", "backend"]
banned = [
  r"inner\s+circle",
  r"bring\s+your\s+circle",
  r"smaller\s+circles",
  r"circle\s+health",
  r"circles\s+inside\s+a\s+side",
]

file_exts = (".ts", ".tsx", ".js", ".jsx", ".py")
ignore_dirs = {".next", ".next_build", "node_modules", "__pycache__"}

hits = []

def should_skip(path: str) -> bool:
  parts = path.split(os.sep)
  return any(p in ignore_dirs for p in parts)

for base in targets:
  if not os.path.isdir(base):
    continue
  for root, dirs, files in os.walk(base):
    # prune ignored dirs
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for fn in files:
      if not fn.endswith(file_exts):
        continue
      path = os.path.join(root, fn)
      if should_skip(path):
        continue
      try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
          txt = f.read()
      except Exception:
        continue
      for pat in banned:
        for m in re.finditer(pat, txt, flags=re.IGNORECASE):
          # record a compact line context
          line_no = txt[:m.start()].count("\n") + 1
          # fetch the line
          line = txt.splitlines()[line_no-1].strip() if txt.splitlines() else ""
          hits.append((path, line_no, pat, line))

if hits:
  print("❌ Banned 'circle' phrasing found:")
  for path, line_no, pat, line in hits[:50]:
    print(f"  - {path}:{line_no}  ({pat})")
    print(f"    {line}")
  sys.exit(1)
else:
  print("✅ OK: No banned 'circle' phrases found in frontend/src or backend.")
PY

