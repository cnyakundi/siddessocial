# Siddes — Batching Playbook (stop losing days)

This repo uses small **change bundles** (overlay zips). Tooling gets slow or fragile when a bundle gets too big.

This playbook keeps momentum by keeping bundles **small**, **testable**, and **reproducible**.

---

## The core rule: micro-bundles
**Cap each bundle** to something like:
- **≤ 10–25 files**
- **≤ ~300–600 lines changed**
- **one theme per bundle** (frontend-only, backend-only, docs-only)

If it feels “big”, it *is* big. Split it.

---

## Package bundles locally
If you’re using the overlay workflow, create the zip locally:

### A) Package current git changes
```bash
chmod +x scripts/make_overlay.sh
./scripts/make_overlay.sh <bundle_name> --summary "<one line>" --changed
```

### B) Package only staged changes
```bash
git add -A
./scripts/make_overlay.sh <bundle_name> --summary "<one line>" --staged
```

Then apply and verify:
```bash
./scripts/apply_overlay.sh ~/Downloads/<bundle_name>.zip
./verify_overlays.sh
./scripts/run_tests.sh
```

---

## Operating procedure (the “never lose state” loop)
1) Apply bundle → `./verify_overlays.sh` → `./scripts/run_tests.sh`
2) If green: commit
3) If tooling gets flaky: stop and capture a clean snapshot (update `docs/STATE.md`, save logs, zip repo excluding caches)

---

## Anti-footguns
- Never include `node_modules`, `.next`, `__pycache__` in bundles.
- Fix **gate failures first**.
- Keep bundles **diff-only**.

### Zsh gotcha: paths with [id]
If you're using zsh, file paths containing brackets like `[id]` are treated as glob patterns.
Fix by quoting the path:

```bash
git add 'frontend/src/app/api/post/[id]/route.ts'
```

Or use `noglob`:

```bash
noglob git add frontend/src/app/api/post/[id]/route.ts
```

---

## Preferred workflow: one apply-helper per bundle
Avoid patch files. The reliable pattern is:

1) Make changes using a single apply-helper script (one per bundle)
2) Run it locally
3) Run gates/tests
4) Package the bundle locally with `scripts/make_overlay.sh`
