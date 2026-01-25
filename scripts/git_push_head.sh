#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repo."
  exit 1
fi

BR="$(git branch --show-current)"
if [[ -z "${BR}" ]]; then
  echo "Could not detect current branch."
  exit 1
fi

echo "== Git: push current branch =="
echo "Branch: $BR"
echo

echo "-- status --"
git status -sb || true
echo

echo "-- pushing (sets upstream) --"
git push -u origin HEAD
echo
echo "✅ Pushed $BR"

# Optional nice-to-have if GitHub CLI is installed.
if command -v gh >/dev/null 2>&1; then
  echo
  echo "Tip (optional): create a PR into main:"
  echo "  gh pr create --base main --head \"$BR\" --fill"
fi
