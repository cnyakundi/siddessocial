# Fix Pack v3 — Nav + Chrome Trust

This pack tightens the app's "chrome" so it feels intentional and trustworthy.

## Changes
- Bottom nav:
  - "Now" icon: Zap → Home (calm utility, not hype).
  - Plus icon stroke: 4 → 2.5 (consistent icon family).
- Desktop side dock:
  - "Now" icon: Zap → Home.
  - Inbox icon unified: MessageSquare → Inbox.
- Top bars:
  - Page title contrast raised (gray-400 → gray-700).
  - Side accent bar added (subtle, persistent side cue).
- Sheets/drawers:
  - Removed duplicate JSX id attributes.
  - Replaced internal/debug subtitle with plain language.
  - "Open thread" icon no longer implies leaving the app (ExternalLink → MessageCircle).
- Empty state:
  - Sparkles icon replaced with MessageCircle (no "gamified" vibe).

## Verify
- ./verify_overlays.sh
- ./scripts/run_tests.sh
- cd frontend && npm run typecheck && npm run build

## Smoke
- Nav: "Now" feels like Home, not Trends.
- Top bars: you can always feel which Side you're in.
- Notifications: no internal/debug copy, close button looks tappable.
- Post actions: "Open thread" no longer looks like an external link.
