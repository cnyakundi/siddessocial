\
#!/usr/bin/env python3
# Find the Next.js entry file without relying on package.json:
# - App Router: **/app/layout.(ts|js)x OR **/src/app/layout.(ts|js)x
# - Pages Router: **/pages/_app.(ts|js)x OR **/src/pages/_app.(ts|js)x
#
# Output: JSON {"mode": "app"|"pages", "path": "<relative path>"} to stdout.
# Exit 1 if not found.

import json
import os
import sys

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    ".turbo",
    ".cache",
    "__pycache__",
    ".venv",
    "venv",
}

def should_skip_dir(d: str) -> bool:
    return d in EXCLUDE_DIRS

def score_path(path: str) -> int:
    # Lower score = better
    p = path.replace("\\", "/")
    score = 0
    if "/frontend/" in p or p.startswith("frontend/"):
        score -= 20
    if "/app/frontend/" in p or p.startswith("app/frontend/"):
        score -= 15
    if "/src/" in p:
        score -= 2
    # shorter depth better
    score += len([seg for seg in p.split("/") if seg])
    return score

def read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

candidates = []

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if not should_skip_dir(d)]

    for name in files:
        if name in ("layout.tsx", "layout.jsx"):
            # must be in .../app/layout.*
            rel = os.path.join(root, name).lstrip("./")
            p = rel.replace("\\", "/")
            if p.endswith("/app/layout.tsx") or p.endswith("/app/layout.jsx") or p.endswith("/src/app/layout.tsx") or p.endswith("/src/app/layout.jsx"):
                txt = read_text(rel)
                # heuristics: likely a root layout contains <html and <body
                if "<html" in txt and "<body" in txt:
                    candidates.append(("app", rel, score_path(rel)))
                else:
                    # still allow, but worse score
                    candidates.append(("app", rel, score_path(rel) + 50))

        if name in ("_app.tsx", "_app.jsx"):
            rel = os.path.join(root, name).lstrip("./")
            p = rel.replace("\\", "/")
            if p.endswith("/pages/_app.tsx") or p.endswith("/pages/_app.jsx") or p.endswith("/src/pages/_app.tsx") or p.endswith("/src/pages/_app.jsx"):
                txt = read_text(rel)
                # heuristic: typical _app has Component + pageProps
                bump = 0
                if "Component" not in txt:
                    bump += 30
                candidates.append(("pages", rel, score_path(rel) + bump))

if not candidates:
    print("No Next entry file found (layout.tsx/layout.jsx or pages/_app.tsx/_app.jsx).", file=sys.stderr)
    sys.exit(1)

candidates.sort(key=lambda x: x[2])
mode, path, _ = candidates[0]
out = {"mode": mode, "path": path.replace("\\", "/")}
print(json.dumps(out))
