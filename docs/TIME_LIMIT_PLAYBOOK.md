# Siddes — Time Limit Playbook (stop losing days)

This repo uses **overlay zips**. Chat windows + attachment tooling can time out or lag when:
- an overlay gets too big,
- the conversation gets too long,
- or you try to ship too many files at once.

This playbook keeps momentum even when chat is flaky.

---

## The core rule: micro-overlays
**Cap each overlay part** to something like:
- **≤ 10–25 files**
- **≤ ~300–600 lines changed**
- **one theme per overlay** (frontend only, backend only, docs/checks only)

If it feels “big”, it *is* big. Split it.

---

## The escape hatch: build the zip locally
When chat can’t (or shouldn’t) package a zip, you can do it locally.

### A) Package current git changes
```bash
chmod +x scripts/make_overlay.sh
./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" --changed
```

### B) Package only staged changes
```bash
git add -A
./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" --staged
```

### C) No git? Package explicit files
```bash
./scripts/make_overlay.sh sd_142a_a_frontend_v0.9.24 --summary "Invite context pills (frontend)" -- \
  frontend/src/app/siddes-invites/page.tsx \
  frontend/src/components/SidePill.tsx
```

Then apply normally:
```bash
./scripts/apply_overlay.sh ~/Downloads/sd_142a_a_frontend_v0.9.24.zip
./verify_overlays.sh
./scripts/run_tests.sh
```

---

## Operating procedure (the “never lose state” loop)
1. **Apply overlay** → `./verify_overlays.sh` → `./scripts/run_tests.sh`
2. If green: **commit**
   ```bash
   git add -A
   git commit -m "Apply <overlay_zip_name>"
   ```
3. If chat starts lagging: **stop**, create a fresh window, and paste:
   - `docs/MIGRATION_PACK.md`
   - current milestone from `docs/STATE.md`
   - the latest `verify_overlays.sh` output

---

## Anti-footguns
- Never include `node_modules`, `.next`, `__pycache__` in overlays.
- Fix **check failures first** (docs/STATE.md and grep tokens matter).
- Keep overlay zips **diff-only**.

### Zsh gotcha: paths with [id]
If you're using zsh, file paths containing brackets like `[id]` are treated as glob patterns.
That's why you see:
`zsh: no matches found: frontend/src/app/api/post/[id]/route.ts`

Fix by quoting the path:
```bash
git add 'frontend/src/app/api/post/[id]/route.ts'
```

Or use `noglob`:
```bash
noglob git add frontend/src/app/api/post/[id]/route.ts
```

Beginner tip: you can skip staging entirely and package with `--changed`.
