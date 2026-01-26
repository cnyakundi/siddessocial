# Four Sides Fix — P0 Pack 4 (Compose + Studio icon/microcopy)

Overlay: **sd_743_four_sides_fix_p0_pack_4_compose_and_studio_icons**  
Date: 2026-01-26

## What changed
- **Close identity icon is Heart (not Lock)** inside Launchpad → Composer Studio.
- Compose placeholder microcopy now reinforces the Close meaning: **Inner Circle**.

## Why
- Lock is a *state badge* (restricted/private), not a Side identity. Close should feel like trusted people, not secrecy.
- Compose is a high-frequency surface; the placeholder text is a powerful teacher. “Talk to Close” is unclear — “Inner Circle” is instantly understood.

## Files touched
- `frontend/src/app/launchpad/composer-studio/studioClient.tsx`
- `frontend/src/app/siddes-compose/client.tsx`

## Manual smoke test
1) Open **/launchpad/composer-studio** (if you use it)
   - Close uses **Heart** icon (not Lock).
2) Open **/siddes-compose** while on Close
   - Placeholder reads: **“Share with Inner Circle…”**

## Notes
- Lock icon remains valid as a **privacy badge** and **SideLock indicator** elsewhere.
