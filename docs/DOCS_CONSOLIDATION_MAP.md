# Docs Consolidation Map
**Updated:** 2026-01-26

Goal: reduce Siddes docs sprawl without losing knowledge.

This repo now treats a small set as **canonical**:
- `docs/CORE_LAWS.md` — constitution
- `docs/STATE.md` — current truth
- `docs/STABILIZATION_MANUAL.md` — how we stabilize
- `docs/VIBE_CODING_PLAYBOOK.md` — how we work (debug + gates + rituals)
- `docs/OVERLAYS_INDEX.md` — history

Everything else is either:
- **Required by checks** (must stay in `docs/`)
- **Reference** (may be archived)
- **Historical fix packs** (archive)

---

## What this overlay does
- Adds the canonical stabilization docs.
- Updates `docs/README.md` to point at the new canonical set.
- Creates `docs/_archive/2026-01-26_docs_slim/` and moves non-required, non-core docs there.
- Adds a missing root `verify_overlays.sh` wrapper (required by `scripts/verify_overlays.sh`).

---

## Next consolidation targets (follow-up overlays)
1) **Go-Live docs**: keep only `GO_LIVE_MASTER_RUNBOOK.md` as canonical; archive the rest.
2) **Compose docs**: merge COMPOSE/COMPOSER documents into one “Compose System” doc.
3) **UI docs**: keep the ones referenced by checks, consolidate the rest into one UI handbook.
4) **Fix packs**: all FIX_PACK / FIX_* become historical → archive.

---
