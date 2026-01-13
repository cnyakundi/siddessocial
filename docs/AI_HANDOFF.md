# AI Handoff (move to a new coding window)
**Updated:** 2026-01-09

If a chat window crashes, paste these files into the new window:
1) `docs/MIGRATION_PACK.md`
2) `docs/STATE.md`
3) `docs/OVERLAYS_INDEX.md`

Then say:
> “Continue from NEXT overlay.”

This ensures **zero re-explaining context**.

## Local overlay workflow (no AI zips)

When continuing in a new window, do **not** ask the AI to create zip files.

Instead:
- Ask the AI for a single `sd_###_apply_helper.sh` script that makes the code changes.
- Run it locally, then package with:
```bash
./scripts/make_overlay.sh sd_###_name_vX --summary "..." --changed
```
- Apply and verify:
```bash
./scripts/apply_overlay.sh ~/Downloads/sd_###_name_vX.zip
./verify_overlays.sh
```
