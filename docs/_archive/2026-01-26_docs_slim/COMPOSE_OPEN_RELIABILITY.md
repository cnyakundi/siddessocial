# Compose Open Reliability (iOS PWA) — sd_748

Problem:
- On iOS PWA, tapping the in-feed composer can appear to do nothing.

Goal:
- In Siddes, the feed composer must always open the full compose page so you can pick a Set (e.g., Friends → Gym Squad) and see a clear Post action.

Fix (sd_748):
1) `SideFeed.tsx`
- Wrap `router.push(href)` with a fallback to `window.location.href = href`.

2) `FeedComposerRow.tsx`
- In the mobile launcher section, open on `onPointerDown` + `onTouchStart` (more reliable than click alone).
- Add dedup so it won’t double-fire.

Acceptance (iPhone PWA):
- Tap the composer field OR + OR send → always opens `/siddes-compose?...`
- Pick a Set (Gym Squad) → Post
