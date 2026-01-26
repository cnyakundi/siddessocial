# Siddes Supersonic Performance Plan (X/Bluesky-grade)

This is the step-by-step path to make Siddes feel "supersonic" without breaking Side privacy.

Non-negotiables:
- Side privacy is enforced server-side.
- Session auth is the truth. Dev viewer headers/cookies are ignored when DEBUG=False.
- Never edge-cache personalized/private payloads.

## Journey status (script order)
- ✅ sd_360: Docs + local perf bench
- ✅ sd_361: Feed cursor contract (limit/cursor/nextCursor/hasMore)
- ✅ sd_362: Feed UI cursor + infinite scroll (sentinel)
- ✅ sd_363: (Optional) content-visibility + smaller DOM cap (cheap scroll win)
- ✅ sd_364: Redis hot-feed cache (viewer+side+topic+cursor+limit)
- ✅ sd_365: True list virtualization (mounted cards ~O(30))
- ✅ sd_366: Normalize Set membership (SetMember table + indexes)
- ⬜ sd_367: Cloudflare R2 media pipeline (Worker same-origin: /m/<key>)
- ⬜ sd_368: SSR/streaming first feed paint (App Router)

## What "supersonic" means (targets)
Feed open (cold):
- LCP < 1.5s on a mid device.
- /api/feed p95 < 250ms for the first page.
- First page payload < ~60KB gz for ~30 PostCards.

Feed scroll:
- 60fps scroll on mid devices.
- Keep mounted PostCards small (virtualize).

## How X / Bluesky achieve the feel
1) Paint instantly (SSR/streaming app shell + skeletons)
2) One timeline call returns a PostCard DTO (no follow-up calls)
3) Cursor pagination
4) Hot timeline caching
5) List virtualization
6) Cheap media (resized, cached, Range for video)

## Notes about Siddes (why this plan is privacy-safe)
- Cache keys always include viewer + side (+ topic), so nothing crosses Sides.
- Private endpoints should be server-cached only (Redis), never shared at the edge.
- Public media can be aggressively cached when keys are content-hashed.

## R2 media: the Siddes way (fast + cache-friendly)
Goal: keep PWA wins and reduce bandwidth.

Important constraint:
- Your service worker only caches same-origin requests (it returns early for cross-origin).

Recommended serving strategy:
- Serve media through your own origin:
  - https://<your-domain>/m/<key>
- Implement with a Cloudflare Worker bound to R2:
  - thumbs/cards: long cache (content-hash keys)
  - video: Range support + correct content-type
  - private sides: signed token or session check in Worker + short cache

## Global Definition of Done (every step)
- No cross-side leakage (manual + tests).
- Private endpoints not cached at the edge.
- Cursor pagination stable (no duplicates/holes across pages).
- UI paints instantly (skeleton) and loads content progressively.
- PostCard payload includes everything needed to render the card.

## sd_366: Set membership normalization

- Added `SiddesSetMember` table (indexed) for join-friendly membership checks.
- Kept `SiddesSet.members` JSON for response parity; writes keep both in sync.
- Feed + post visibility checks now prefer `SiddesSetMember` (with JSON fallback for pre-migration DBs).

## sd_367 status
- Added backend `siddes_media` app (MediaObject registry + presigned PUT/GET).
- Added `/api/media/*` endpoints and same-origin `/m/<key>` dev redirect.
- Added Next routes: `/api/media/*` proxy and `/m/*` redirect re-emit.
- Added Cloudflare Worker example: `ops/cloudflare/r2_media_worker`.
- Added docs: `docs/MEDIA_R2.md`.

