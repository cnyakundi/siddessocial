# Siddes — Overlay Workflow (must-follow)
**Updated:** 2026-01-09

Siddes is built via **overlay zips**. The workflow goal is: **zero context** needed when you move between chat windows.

---

## 1) Non-negotiables
Every overlay zip must:

### A) Include a root `README_OVERLAY.md`
It must contain:
- `Summary: ...` (one line)
- what changed + why
- acceptance criteria
- test steps
- rollback steps

### B) Update docs
Each overlay must ensure these stay correct:
- `docs/STATE.md` (current status + NEXT overlay)
- `docs/MIGRATION_PACK.md` (only if the product/architecture meaningfully changed)

### C) Pass the quality gate
After applying any overlay:
```bash
./verify_overlays.sh
./scripts/run_tests.sh
```

### D) Avoid fix packs
We ship patch overlays only if necessary (broken overlay, security issue, or critical build break).

---

## 2) Applying overlays (standard)
Run from your repo root:
```bash
chmod +x scripts/apply_overlay.sh
./scripts/apply_overlay.sh ~/Downloads/<zip>
./verify_overlays.sh
./scripts/run_tests.sh
```

---

## 3) Overlay authoring rules
- Keep overlays small and coherent (one theme).
- Never ship “half features.”
- Prefer adding new files over editing many existing ones.
- If editing core code, include at least one test or smoke-check.

---

## 4) README_OVERLAY.md template (copy/paste)
```md
# sd_<NNN>_<slug>_vX.Y.Z

Summary: <one line>

## Why
<why this exists>

## What changed
- ...

## Acceptance criteria
- ...

## How to test
```bash
./verify_overlays.sh
./scripts/run_tests.sh
# plus overlay-specific commands
```

## Rollback
```bash
git checkout -- <paths>
```
```

---

## 5) Documentation rule (“GitHub memory”)
The repo must answer these without chat context:
- What is Siddes?
- What is the next overlay?
- What changed in the last overlay?
- How do I test?
- How do I run Docker dev?

If any of those are not obvious from the repo docs, the overlay is not “done.”

---

## 6) When chat/tools time out (escape hatch)
If the chat UI becomes unresponsive or a zip is too large for tooling, **don’t block**.

Use the local overlay builder:
```bash
chmod +x scripts/make_overlay.sh
# package your current git changes into a diff-only overlay:
./scripts/make_overlay.sh sd_<NNN>_<slug>_vX.Y.Z --summary "<one line>" --changed
```

Then apply like any other overlay:
```bash
./scripts/apply_overlay.sh ~/Downloads/sd_<NNN>_<slug>_vX.Y.Z.zip
./verify_overlays.sh
./scripts/run_tests.sh
```
