#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repo."
  exit 1
fi

echo "== Git: where am I? =="
echo
echo "Repo: $(git rev-parse --show-toplevel)"
echo "Branch: $(git branch --show-current)"
echo

echo "-- status --"
git status -sb || true
echo

echo "-- remotes --"
git remote -v || true
echo

echo "-- upstream (if set) --"
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "(no upstream set)"
echo

echo "-- last 8 commits --"
git log --oneline -n 8 || true
echo

echo "Tip: To push the current branch safely:"
echo "  git push -u origin HEAD"
