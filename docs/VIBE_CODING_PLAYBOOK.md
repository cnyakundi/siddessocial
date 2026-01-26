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

## Siddes-specific ship contracts
- Side truth always visible
- Widening visibility is hard (explicit confirm)
- Back navigation always works
- Sheets/modals never trap users (no full-screen takeover without clear exit; no scroll-lock bugs)
