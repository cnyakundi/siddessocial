# Portaled Sheets (sd_747)

This pack fixes iOS/PWA “stuck modals” across all post-related sheets.

## Root cause
The feed is virtualized and uses `transform: translateY(...)` for rows.
In Safari/iOS, transformed ancestors can break the expected behavior of `position: fixed` descendants,
so “fixed inset-0” overlays rendered inside a row may not cover the viewport → outside taps don’t hit the backdrop.

## Fix
Portal overlays to `document.body` using `createPortal`, and make backdrops close on:
- `onPointerDown` + `onTouchStart` (close immediately)
- `onClick` (fallback)

## Files patched
- `frontend/src/components/PostActionsSheet.tsx` (already handled by sd_745/sd_746)
- `frontend/src/components/ChipOverflowSheet.tsx`
- `frontend/src/components/EchoSheet.tsx`
- `frontend/src/components/EditPostSheet.tsx`
- `frontend/src/components/QuoteEchoComposer.tsx`
- `frontend/src/components/ProfileActionsSheet.tsx`
- `frontend/src/components/CirclePickerSheet.tsx`

## Acceptance checks (iPhone PWA)
For each sheet: open it, then tap outside anywhere → it closes instantly, every time.
