# Siddes — Change Bundle Workflow
**Updated:** 2026-01-26

Siddes ships changes as small **diff-only bundles** (overlay zips).

Goal: **zero hidden context** — a collaborator should be able to understand what changed, apply it, and verify it from repo docs alone.

---

## 1) Non-negotiables
Every change bundle must:

### A) Include a short change note
Pick one:
- add a row to `docs/OVERLAYS_INDEX.md`, or
- add a small note under `docs/` (single file, short and scannable)

### B) Keep core docs accurate
- `docs/STATE.md` (current status + what’s next)
- `docs/PROJECT_HANDOFF.md` (how to run + where truth lives)

### C) Pass the quality gate
After applying any bundle:

```bash
./verify_overlays.sh
./scripts/run_tests.sh
```

---

## 2) Applying overlays
Run from repo root:

```bash
chmod +x scripts/apply_overlay.sh
./scripts/apply_overlay.sh ~/Downloads/<zip>
./verify_overlays.sh
./scripts/run_tests.sh
```

---

## 3) Authoring rules
- Keep bundles small and coherent (one theme).
- Never ship “half features.”
- Prefer adding new files over editing many existing ones.
- If editing core flows, include at least one smoke check.

---

## 4) If a bundle is too big
Split it into two or three bundles with clean boundaries.
