# Siddes — Vibe Coding Playbook (Workflow + Gates + Debugging)
**Updated:** 2026-01-26

This is the “how we work” doc. It consolidates:
- Engineering Playbook
- Debug Snapshot template
- Testing ladder / gates
- Overlay workflow rituals

If you only keep one workflow doc, keep this one.

---

## 1) The workflow rules
1. **One baseline is truth.** Start from a known branch+commit or overlay zip.
2. **One active window.** You may track many issues; you only code one at a time.
3. **Small batches.** One overlay = one idea.
4. **First real error wins.** Don’t chase downstream noise.
5. **Quarantine before delete.** Move uncertain deletions to `deprecated/` first.
6. **Ship guardrails.** Every fix adds a check/test/assertion when reasonable.

---

## 2) Debug Snapshot (copy/paste template)
Use this anytime you report a bug:

### Baseline
- Branch:
- Commit:
- Zip/Overlay ID:
- Local or Prod:
- What changed most recently:

### Repro
1)
2)
3)

Expected:
Actual:

### Evidence (first real error)
- Frontend console (first error):
- Backend logs (first exception):
- Stack trace file:line:

---

## 3) The Test Ladder / Gates
### L0 — Preflight (always)
```bash
./verify_overlays.sh
```

### L1 — Fast checks (always)
Frontend:
```bash
cd frontend && npm run typecheck
```

Backend (inside Docker):
```bash
docker compose -f ops/docker/docker-compose.dev.yml exec backend python -m compileall backend
```

### L2 — Tests (when changing logic)
```bash
./scripts/run_tests.sh
```

### L3 — Build (before merging / before shipping)
```bash
cd frontend && npm run build
```

---

## 4) Overlay / apply-helper ritual
**Beginner-safe rule:** apply one overlay at a time and run gates immediately.

Typical apply-helper flow:
```bash
chmod +x ~/Downloads/sd_XXX_apply_helper.sh
cd /path/to/your/sidesroot
~/Downloads/sd_XXX_apply_helper.sh

./verify_overlays.sh
./scripts/run_tests.sh
cd frontend && npm run typecheck && npm run build
```

---

## 5) Repo hygiene (stay lean)
### Local junk you can delete anytime
- `frontend/.next/`
- `frontend/.next_build/`
- `.backup_*` (local backups created by apply scripts)
- `artifacts/` contents (generated outputs)

### Quarantine zone
Use `deprecated/` for code you *think* is dead but aren’t 100% sure about.

---

## 6) “Finish fixes” definition
A fix is only finished when:
- the repro no longer reproduces
- gates pass
- `docs/STATE.md` updated (what changed + why)
- a guardrail exists if it was a recurring bug

---
