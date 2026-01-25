# Git Quickstart (Siddes)

This doc is intentionally *tiny* and beginner-safe.

## The 2 commands you should memorize

**1) Where am I?**
```bash
git status -sb
```

**2) Push whatever branch you are on**
```bash
git push -u origin HEAD
```

That `HEAD` trick is the cure for: *"I committed on branch X but pushed main."*

## Your exact situation (common)

If you see something like:
- `## ui/quality-bootstrap`
- you committed (`git commit -m "..."`)
- then you ran `git push -u origin main`
- and Git said: **Everything up-to-date**

That means: you pushed **main** (which did not change) and your commit is still sitting on **ui/quality-bootstrap**.

Fix:
```bash
git push -u origin HEAD
```

## When you want the work on main

Option A (recommended): open a PR
```bash
gh pr create --base main --head $(git branch --show-current) --fill
```

Option B (direct merge, no PR):
```bash
git switch main
git pull --rebase
git merge $(git branch --show-current)
git push
```

## “Make Git less annoying” settings (safe)

These make `git push` / `git pull` behave more predictably:

```bash
git config --global push.default current
git config --global push.autoSetupRemote true
git config --global pull.rebase true
git config --global rebase.autoStash true
```

## If a push is rejected (non-fast-forward)

This usually means GitHub has commits you don’t have locally.

Safe fix:
```bash
git pull --rebase
git push
```

If you want to inspect first:
```bash
git fetch
git log --oneline --decorate --graph --all --max-count=20
```
