# Fix Pack v2 — Calm Feed Modules + Consistency

This pack removes “growth-hack energy” from feed module cards and tightens icon consistency.

## Changes
- Feed modules:
  - `public_today` icon: TrendingUp → Hash (topics, not hype).
  - `side_health` icon: TrendingUp → Shield (safety posture).
  - `set_prompt` redesigned to match the rest of the feed (no black card, no Sparkles, no yellow).
- Desktop top bar: page title contrast raised (gray-400 → gray-700).
- Icon strokes:
  - DesktopSideRail Plus icons normalized to strokeWidth 2.5.
  - MobileSideTabsRow icon stroke normalized (2.6 → 2.5).

## Verify
- ./verify_overlays.sh
- ./scripts/run_tests.sh
- cd frontend && npm run typecheck && npm run build

## Smoke
- Feed: module cards feel like calm “utility hints”, not a viral dashboard.
- Desktop: page title reads as active UI (not disabled).
- Icons: no obvious mixed-weight icon look in nav areas.
