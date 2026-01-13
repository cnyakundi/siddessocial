# Public Visual Calm (sd_132)

This overlay introduces a **Visual Calm** option for the **Public Side**.

Goal: make the Public feed feel like a **magazine**, not a casino.

## What changes
When enabled, **engagement numbers** (currently the Signals count) are:
- **Hidden by default** in the Public feed
- **Revealed on hover / focus / press** (desktop + mobile)
- Always available via the **Signals sheet**

A small toggle is added to the Public feed UI:
- `Counts: Hidden` (default)
- `Counts: Shown`

## Flag
- `NEXT_PUBLIC_SD_PUBLIC_CALM_UI=1`

If the flag is OFF, the UI behaves exactly as before.

## Preference storage
The user preference is stored client-side:
- localStorage key: `sd.publicCalmUi.v0`
- shape: `{ "showCounts": boolean }`

## Notes
- This is **Public-only**.
- This is **UI-only** (no backend changes).
- This is designed to reduce "clout posting" pressure while keeping Signals fully accessible.
