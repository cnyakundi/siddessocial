# Compose Final Perfection (sd_739)

Goal: **simplicity + perfect alignment** between the in-feed composer and feed rows.

## What was wrong
- Feed rows had **double px-4** on mobile (wrapper + virtual row), making posts shift right compared to the composer.
- Composer had a few “extra” cues (shouty subtitle, decorative dot) that broke the calm Siddes feel.
- Tap targets were slightly under ergonomic minimum.

## What sd_739 does
1) **Fix alignment**
- Removes redundant per-row `px-4` in `SideFeed.tsx` virtual row wrapper so posts align with composer.

2) **Composer cleanroom polish**
- Matches avatar sizing to PostCard (44 mobile / 56 desktop).
- Calms subtitle typography.
- Removes decorative dot; uses focus-within ring with Side theme.
- Enforces 44×44 hit targets for + / Send.
- Removes hard-coded inner width (parent already constrains).

## Acceptance checks
- Mobile: left edges of composer and post rows match exactly.
- Desktop: composer and rows share the same content frame (no “one-off” widths).
- Focus: tapping into composer shows a subtle Side-colored ring (clean, not loud).
- Buttons: + / Send are easy to hit with thumb.
