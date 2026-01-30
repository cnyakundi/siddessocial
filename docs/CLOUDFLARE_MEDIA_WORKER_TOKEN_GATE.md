# Cloudflare Media Go-Live (Token-Gated)

## What this enables
- Media served from Cloudflare R2 at the edge via `/m/*`
- Private media requires a signed token, so it won't leak or be publicly cached
- Public media can be cached hard at the edge

## Required configuration

### DigitalOcean (Django env vars)
Circle:
- `SIDDES_MEDIA_TOKEN_SECRET=<long random secret>`  (must match Worker)
- Optional: `SIDDES_MEDIA_PRIVATE_TTL=600` (seconds; default 600)

### Cloudflare Worker
In `ops/cloudflare/r2_media_worker`:
1) `cp wrangler.toml.example wrangler.toml` and fill placeholders
2) `npx wrangler secret put MEDIA_TOKEN_SECRET`
3) `npx wrangler deploy`

### Route
Route your zone/path to the Worker:
- `https://yourdomain.com/m/*`

## What to test
1) Create an image post on a private Side (friends/close/work)
2) Open the same post from an allowed viewer -> image loads
3) Try opening the image URL in an incognito window -> should fail after token expiry (or immediately if no token)
