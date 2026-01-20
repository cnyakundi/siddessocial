# Repair compose/search Suspense wrappers + PostCard cleanup (sd_395)

## Why
Two common failure modes after iterative fixes:
1) `/siddes-compose` and `/search` ended up with `client.tsx` containing the same server wrapper as `page.tsx`,
   causing circular imports and losing the real client implementation.
2) `PostCard.tsx` accumulated a stray fragment between `extractFirstUrl()` and `safeLinkInfo()` that breaks parsing.

## What sd_395 does
- Restores correct client implementations from the earliest `sd_390` backup that still contains `"use client"` pages.
  - Compose: uses `.backup_sd_390_useSearchParams_suspense_*/frontend/src/app/siddes-compose/page.tsx`
    (fallback: `scripts/sd_384_siddes_compose_page.tsx` if needed)
  - Search: uses `.backup_sd_390_useSearchParams_suspense_*/frontend/src/app/search/page.tsx`
- Rewrites `page.tsx` for both routes to a small server `<Suspense>` wrapper.
- Removes any stray non-comment content between `extractFirstUrl()` and `safeLinkInfo()`.

## Verify
From repo root:
- `npm run typecheck`
- `npm run build`

