# Release Checklist (Siddes)

This is the “don’t ship chaos” list.

---

## 1) Baseline is anchored
- `docs/STATE.md` has:
  - Branch
  - Commit
  - Zip/Overlay ID
  - Environment (local/prod)
  - Last overlay applied

## 2) Repo is clean enough
- `git status -sb` makes sense (no mystery drift)
- If you must ship with changes: they are intentional and documented

## 3) Gates pass (must)
Run:
```bash
bash scripts/run_gates.sh
```

## 4) Full checks pass (recommended before push)
Run:
```bash
./verify_overlays.sh
bash scripts/run_tests.sh
```

## 5) Golden flows (manual 2–5 min)
- login / signup works
- feed loads
- open post detail
- **back navigation works** (mobile + desktop)
- compose works
- switch side works (theme flips, content matches side)

## 6) Siddes privacy contracts hold
- Side truth is visible on feed + detail + compose
- No accidental widening (Close → Friends → Public)

## 7) Packaging discipline (overlay workflow)
- One overlay = one idea
- Includes VS Code terminal apply instructions
- Docs updated if behavior changed (STATE + relevant runbook)

✅ If all green: ship.
