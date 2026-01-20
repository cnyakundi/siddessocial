# Next.js `useSearchParams` Suspense Fix (sd_390)

## Symptom
Production build/export fails with:

- `useSearchParams() should be wrapped in a suspense boundary`

This happens when Next tries to prerender pages that read query params via `useSearchParams()`.

## Fix
For each affected route:
- Move the current client page to `client.tsx`
- Replace `page.tsx` with a **server** wrapper that renders:

```tsx
<Suspense fallback={...}>
  <Client />
</Suspense>
```

## Routes
- `/siddes-compose`
- `/search`

## Why this is safe
- The UI stays identical (client code unchanged)
- The wrapper only adds a prerender-safe boundary for static export.

