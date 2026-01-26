# Post Actions Sheet Dismiss Reliability (sd_742)

Problem (iOS/PWA):
- Tapping outside the Post Actions Sheet sometimes **does not close** it.
- Root cause: the backdrop used `onPointerDown` with `preventDefault()`, which can suppress the `onClick` event in iOS PWAs.

Fix:
- Close the sheet on **onPointerDown** (and keep onClick as a fallback).

Files:
- `frontend/src/components/PostActionsSheet.tsx`

Acceptance test:
- Open post options (⋯)
- Tap anywhere outside the sheet → it closes instantly (no "stuck modal")
