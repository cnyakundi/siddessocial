# Why the ⋯ Post Actions modal wouldn't dismiss on iOS PWA (Root Cause) — sd_745

## Symptom
- On iOS PWA, the Post Actions sheet (⋯) is hard to dismiss by tapping outside.

## Real root cause
Your feed is virtualized and positions rows using CSS **transform**:

`SideFeed.tsx` renders rows with:
- `position: absolute`
- `transform: translateY(...)`

A transformed ancestor can become the containing block for **position: fixed** descendants in Safari/iOS.
So "fixed inset-0" overlays rendered inside a post row may **not cover the full viewport** —
taps outside the visible sheet hit the page, not the backdrop.

## Fix
Portal the sheet to `document.body` using `createPortal`, so it's no longer nested under transformed rows.

File changed:
- `frontend/src/components/PostActionsSheet.tsx`

## Acceptance test (iPhone PWA)
1) Open ⋯ menu on a post
2) Tap anywhere outside the sheet (top bar, feed, bottom nav) → it closes every time
