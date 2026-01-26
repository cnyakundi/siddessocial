# Siddes Docs
**Updated:** 2026-01-26

This repo has a **lean docs system**. The goal is: fewer sources of truth, easier navigation, faster fixes.

---

## Start here (canonical)
If you read nothing else, read these in order:

1) `CORE_LAWS.md` — Siddes constitution (non‑negotiables)
2) `STATE.md` — current truth: where we are + what’s next
3) `STABILIZATION_MANUAL.md` — how we stabilize as the codebase grows
4) `VIBE_CODING_PLAYBOOK.md` — workflow, debug snapshot, test ladder, gates
5) `OVERLAYS_INDEX.md` — history of overlays and why they exist

---

## Launch / go-live
- `DEPLOYMENT_GATES.md` — readiness checklist (referenced by checks)
- `GO_LIVE_MASTER_RUNBOOK.md` — end-to-end go-live runbook
- `SIDDES_BOOK.md` — philosophy + architecture + feature surface
- `PROJECT_HANDOFF.md` — master handoff doc (product + tech)

---

## Required-by-checks reference docs
Some docs must remain in `docs/` because automated checks validate them
(e.g., Inbox contracts, visibility policy, throttling, etc.). If you want to consolidate them later,
do it in a dedicated overlay and keep the filenames as wrappers until checks are updated.

---

## Archived docs
Historical fix packs, older drafts, and duplicates live in:
- `docs/_archive/`

You can still read them, but they are **not** canonical.

---

## Tip
If you feel lost, go back to `STATE.md`. If you feel tempted to work on five things at once, go to `STABILIZATION_MANUAL.md`.
