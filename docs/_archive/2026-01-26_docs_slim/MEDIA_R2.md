# Siddes Media on Cloudflare R2

Goal: fast, cache-friendly media for Siddes (images + video) without breaking Side privacy.

## The critical constraint (PWA speed)
Your service worker caches **same-origin** requests only. If you serve images/videos from a separate domain, you lose a big part of the PWA speed wins.

**Therefore:** serve media through your own origin:
- `https://<your-domain>/m/<r2_key>`

In production, route `/m/*` at the edge to a Cloudflare Worker bound to R2.

## What sd_367 adds
Backend:
- `POST /api/media/sign-upload` -> returns presigned PUT URL to upload directly to R2
- `POST /api/media/commit` -> marks an object committed (optionally public)
- `GET  /api/media/url?key=<r2_key>` -> returns short-lived signed GET URL (owner-only unless public)
- `GET  /m/<r2_key>` -> **dev fallback**: redirects to a short-lived signed GET URL

Frontend:
- `POST /api/media/*` proxy routes (cookie-forwarding + dev viewer header)
- `GET  /m/*` dev handler that re-emits the backend redirect from the Next origin

Ops:
- `ops/cloudflare/r2_media_worker/*` example Worker to serve `/m/*` from R2 (with Range support).

## Required env vars (backend)
Set these for presigning (S3-compatible R2 API):
- `SIDDES_R2_ACCOUNT_ID` (or `SIDDES_R2_ENDPOINT`)
- `SIDDES_R2_BUCKET`
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`

If you prefer to provide the full endpoint instead of account id:
- `SIDDES_R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`

## Local dev flow (no Worker)
1) Request an upload URL:
   - `POST /api/media/sign-upload` with JSON: `{ "kind": "image", "contentType": "image/png" }`
2) Upload directly to R2 using the returned URL (HTTP PUT).
3) Commit:
   - `POST /api/media/commit` with JSON: `{ "r2Key": "u/me_1/<uuid>.png", "isPublic": 1 }`
4) Display:
   - Use `src="/m/<r2Key>"` in the UI (dev: redirect; prod: worker).

## Production flow (recommended)
- Deploy a Cloudflare Worker bound to R2 and route it to `/m/*`.
- Ensure the Worker sets:
  - `Cache-Control` (long for immutable keys)
  - `Accept-Ranges: bytes` and `Content-Range` for partial responses (video)

See `ops/cloudflare/r2_media_worker/README.md`.

## Security notes
- This phase treats private media as **owner-only** (safe default).
- Later: when media is attached to Posts, authorization should be derived from Post visibility (Side + Set membership).
