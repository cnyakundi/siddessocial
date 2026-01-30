# Compose Standard (Mobile) — Launcher Rule (sd_741)

Your screenshot shows the exact problem:
- In **Friends**, tapping the in-feed composer opens the keyboard, but Siddes needs audience + Circle selection clarity (e.g., **Gym Squad**).
- On mobile, the feed is not where you should be editing a full post.

## Rule
**Mobile feed composer = LAUNCHER.**

Any tap into the in-feed composer on mobile should open:
- `/siddes-compose?side=friends&set=<active_set>` (or topic for Public)

## What sd_741 does
1) Makes navigation robust in `SideFeed.tsx` (router push + fallback).
2) Intercepts **mobile** focus/tap on the in-feed textarea and calls `onOpen()` immediately.

## Acceptance test
- Tap composer field in Friends → opens compose page
- Select Gym Squad → Post
- Return to feed → new post visible
