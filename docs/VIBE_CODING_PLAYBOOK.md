# Vibe Coding Playbook (Siddes Edition)

**Goal:** move fast without turning the repo into chaos.

You vibe-code features, but the project stays:
- reproducible
- debuggable
- refactorable
- shippable

---

## The 10 Rules of Vibe Coding That Scales
1. **One baseline is truth.** Every session starts from a named baseline (branch + commit or zip ID).
2. **Small batches only.** One change-set = one idea.
3. **One-command gates are sacred.** If gates fail, stop and fix gates first.
4. **Always capture the first real error.** The first exception/stack trace is gold.
5. **Always have a deterministic repro.** If you can’t reproduce it, you can’t truly fix it.
6. **Quarantine before delete.** “Looks unused” is not proof. Move to `deprecated/` first.
7. **Widening visibility requires confirmation.** (Siddes rule) Close → Friends → Public must never happen accidentally.
8. **UI issues are treated like broken contracts.** Not “feels weird” — it’s a contract (z-index/scroll-lock/back-nav) broken.
9. **No multi-window drift.** Many windows are ok, but only one active truth.
10. **GPT works from snapshots, not memories.** Always provide a structured Debug Snapshot pack.

---

## Recommended composition
### /docs
- `STATE.md` — baseline + what’s green + what’s broken
- `DEBUG_SNAPSHOT.md` — how to report a bug
- `ARCHITECTURE.md` — 1–2 pages “how Siddes is wired”
- `DEAD_CODE_LEDGER.md` — declutter audits output
- `RELEASE_CHECKLIST.md` — must-pass list before push

### /scripts
- `run_gates.sh` — one command truth (fast)
- `debug_pack.sh` — produces a pasteable debug snapshot
- `declutter_audit.sh` — finds duplicates/unused candidates safely (or use your existing declutter tooling)
- `/checks/*` — small focused checks
- `/dev/*` — seed/reset/smoke scripts

### /deprecated
- quarantine zone for “probably unused” code

---

## Daily workflow loop
1) Sync baseline (fill `docs/STATE.md`)  
2) Run gates (`bash scripts/run_gates.sh`)  
3) Make one change  
4) Run gates again  
5) Package change (one overlay per change-set)

---


## Test Ladder / Tooling

You don’t want “all tests in the world” every time. You want a ladder that keeps you fast *and* safe.

### Tools in this repo (today)

**L0 — Preflight (always)**
- `./verify_overlays.sh`  
  Ensures overlay tooling is sane and required docs/scripts exist.

**L1 — Gates (always)**
- `bash scripts/run_tests.sh --smoke`  
  Smoke mode = **verify_overlays + gates** (fast truth).
- Under the hood, this runs:
  - Frontend: `npm run typecheck` + `npm run build`
  - Backend: `python manage.py check` (via docker compose)
  - P0 sanity: `scripts/dev/p0_gate.sh` (critical Next API routes, proxy invariants, migrations check, optional HTTP smoke)

**L2 — Full harness (often / before push)**
- `bash scripts/run_tests.sh`  *(default = full)*  
  Runs:
  - `./verify_overlays.sh`
  - every `scripts/checks/*.sh` (strict)
  - frontend lint/typecheck/test/build
  - backend compileall + Django check/tests (best-effort depending on env)

**L4 — E2E (already wired)**
- Playwright:
  - `cd frontend && npm run e2e`
  - `cd frontend && npm run e2e:ui` (debug UI)

### Tools we add as we mature (planned)

**Frontend unit tests: Vitest (Vite-powered)**
- When added, swap `frontend/package.json` `"test"` to run Vitest.
- Keep a tiny “smoke” suite that stays fast (runs in PRs).
- Run full unit suite before releases.

**Backend unit tests: Django tests today → pytest later (optional)**
- Today: `python manage.py test` (or via docker compose).
- If the suite grows, consider `pytest + pytest-django`.

### When to run what (practical defaults)

**Every change-set (always):**
```bash
./verify_overlays.sh
bash scripts/run_tests.sh --smoke
```

**When you touch tricky logic or shared UI primitives (often):**
```bash
bash scripts/run_tests.sh
```

**Before release (must):**
- `bash scripts/run_tests.sh`
- Playwright golden flows + quick manual 2–5 min “golden run”

Reference: `docs/TESTING.md` is the longer, evolving testing reference. Keep this playbook section short and opinionated.

## Siddes-specific ship contracts
- Side truth always visible
- Widening visibility is hard (explicit confirm)
- Back navigation always works
- Sheets/modals never trap users (no full-screen takeover without clear exit; no scroll-lock bugs)
