# Fix Pack v1 — UI Trust + Simplicity

This pack makes Siddes feel more intentional by removing ambiguous semantics and tightening UI physics.

## Changes
- Nav semantics: Now icon (Zap → Home) and Inbox icon unified.
- Post actions: Open thread no longer looks like an external link.
- PostCard: "React" renamed to Like (or Ack on Work). Header is no longer a fake button.
- Feed: Virtualized rows get consistent gutters on mobile.
- Threading: removed duplicate reply CTAs; replies indent once with a subtle rail; reply tap targets increased.
- Headers: Side accent bar added (mobile + desktop).
- Cleanups: duplicate JSX ids removed; icon stroke widths normalized in inspector rail.

## Verify
Run:
- ./verify_overlays.sh
- ./scripts/run_tests.sh
- cd frontend && npm run typecheck && npm run build

## Smoke
- Feed: cards never touch screen edge; Now icon feels “home”, not “hype”.
- Post: only bottom composer is the reply entry; reply buttons easy to tap.
- Switch sides: header shows a clear side accent bar at all times.
