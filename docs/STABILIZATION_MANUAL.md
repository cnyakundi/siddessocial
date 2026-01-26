# Siddes — Stabilization Manual
**Updated:** 2026-01-26

This manual is how Siddes stays shippable as it grows.
The goal is not “fix everything today” — the goal is **install a system** where stability becomes inevitable.

---

## 0) What “stabilization mode” means
While stabilizing:
- ✅ Bug fixes, simplification, deletion, guardrails
- ✅ Documentation consolidation (reduce sources of truth)
- ✅ Tests/checks/gates hardening
- ❌ New features (unless they remove blockers)

Rule of thumb: if it increases surface area, it waits.

---

## 1) The single biggest rule: One active window
Siddes is now big enough that multitasking creates bugs.

**You may track many windows, but you only code in one.**

### The 3 lists
Keep these lists in one place (a single file or a single note):
- **NOW:** the one thing you are actively fixing
- **NEXT:** what’s queued
- **PARKED:** ideas/bugs you noticed but refuse to touch yet

If something pops up while you’re fixing:
- add one line to PARKED
- go back to NOW

---

## 2) The daily stabilization loop (30–120 min chunks)
Every session follows the same loop:

1) **Start from truth**
   - confirm baseline (branch/commit/zip)
   - confirm Side + viewer assumptions
2) **Repro**
   - write a minimal repro path
   - capture the **first real error**
3) **Delete-first pass**
   - remove obvious dead code in the path you’re touching
   - quarantine uncertain deletions to `deprecated/`
4) **Fix the root cause**
   - prefer the smallest change that restores an invariant
5) **Add a guardrail**
   - check script token, test, or assertion that prevents regression
6) **Run gates**
   - `./verify_overlays.sh`
   - backend checks/tests
   - frontend typecheck/build
7) **Update docs**
   - STATE: what changed and why
8) **Stop**
   - ship the fix; do not chain “one more thing”

---

## 3) Triage: what to fix first (P0/P1/P2)
### P0 — Launch-blockers
- Can’t login / signup / stay logged in
- Can’t send a DM / core action fails
- Cross-Side privacy leak
- Navigation traps (can’t go back / can’t close sheet)
- Media picker / upload broken on common devices
- Data corruption or unread counts lying per viewer

### P1 — Serious quality issues
- Confusing UX that causes repeated user error
- Major performance regressions
- Notification spam / missing notifications

### P2 — Polishes
- Copy tweaks, spacing, animations, minor UI nits

Rule: **P0 before anything**. P1 only when P0 is green. P2 after launch.

---

## 4) Declutter rules (how to delete safely)
Deletion is the fastest stability tool *if you do it safely*.

### The 4-stage deletion ladder
1) **Inline delete** (safe): remove unused vars/branches in the file you’re editing
2) **Module delete** (medium): remove unused helpers *with grep proof*
3) **Quarantine** (safe for uncertain): move to `deprecated/` with a note
4) **Hard delete** (only after): it survives a week of normal usage

### “Looks unused” is not proof
Before deleting anything non-trivial:
- grep for imports/usages
- search for string tokens (routes, env vars)
- run typecheck/build/tests

---

## 5) Docs discipline (how to stop doc sprawl)
Doc sprawl is context bleed in paper form.

### Canonical docs (the only ones you should “think in”)
- `docs/CORE_LAWS.md`
- `docs/STATE.md`
- `docs/STABILIZATION_MANUAL.md`
- `docs/VIBE_CODING_PLAYBOOK.md`
- `docs/OVERLAYS_INDEX.md`

Everything else is reference material.

### Archiving rule
Historical fix packs, duplicates, abandoned drafts → `docs/_archive/`.

---

## 6) Stabilization milestones (what “done” looks like)
You exit stabilization mode when:
- P0 bug count is near-zero
- core user actions are reliable
- checks/gates catch common regressions
- docs are lean: one source of truth per topic

A stable product ships faster than a “clever” product.

---
