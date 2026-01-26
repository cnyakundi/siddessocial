# RootLayout Suspense Guard (sd_391)

## Why
Next.js static export can fail with:

- `useSearchParams() should be wrapped in a suspense boundary`

This happens when a route performs a CSR bailout due to client hooks like `useSearchParams()`.

## What this does
Adds a global `<Suspense>` boundary in `frontend/src/app/layout.tsx` around the app providers + children.

This is a **safety net** to reduce future failures, even if new pages start using `useSearchParams()`.

## Notes
- This does not change your UI logic.
- If a specific route still fails, it may still need a local Suspense wrapper (like sd_390).
