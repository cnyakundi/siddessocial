# Post Actions: Outside Tap Dismiss (iOS/PWA) — sd_743

Symptom:
- On iOS PWA, the Post Actions modal (⋯) often won't dismiss when you tap outside it.

Root cause:
- iOS PWA can suppress the synthetic `click` event when `preventDefault()` occurs on pointer/touch.
- If the backdrop only closes on `onClick`, the sheet can feel "stuck".

Fix:
- Close on `onTouchStart` (most reliable on iOS) and `onPointerDown` (modern browsers).
- Keep `onClick` as a fallback.

File:
- `frontend/src/components/PostActionsSheet.tsx`

Acceptance:
- Open ⋯ menu
- Tap outside the sheet → closes instantly, every time
