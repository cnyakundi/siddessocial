#!/usr/bin/env python3
# Find the Next.js project root by locating a package.json that depends on "next".
# We exclude node_modules and common build output folders.
#
# Output: chosen root path relative to repo root ('.' allowed).
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

def has_next_dep(pkg: dict) -> bool:
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        deps = pkg.get(key) or {}
        if isinstance(deps, dict) and "next" in deps:
            return True
    return False

candidates = []
for root, dirs, files in os.walk("."):
    # prune excluded dirs
    dirs[:] = [d for d in dirs if not should_skip_dir(d)]
    if "package.json" not in files:
        continue

    pj = os.path.join(root, "package.json")
    try:
        with open(pj, "r", encoding="utf-8") as f:
            pkg = json.load(f)
    except Exception:
        continue

    if has_next_dep(pkg):
        # Score: prefer paths containing "frontend", then shortest depth
        normalized = root.replace("\\", "/")
        score = 0
        if "frontend" in normalized:
            score -= 10
        depth = len([p for p in normalized.split("/") if p and p != "."])
        score += depth
        candidates.append((score, root))

if not candidates:
    print("No Next.js package.json found (dependency 'next' not detected).", file=sys.stderr)
    sys.exit(1)

candidates.sort(key=lambda x: x[0])
chosen = candidates[0][1].rstrip("/")

if chosen in (".", "./", ""):
    print(".")
else:
    if chosen.startswith("./"):
        chosen = chosen[2:]
    print(chosen)
