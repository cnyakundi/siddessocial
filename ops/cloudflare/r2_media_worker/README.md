# Siddes R2 Media Worker (Token-Gated)

This Worker serves `GET /m/<key>?t=<token>` directly from an R2 bucket binding.

## Why
- Lets Cloudflare serve media from R2 at the edge
- Supports Range reads (video seek)
- Prevents private media leaks by requiring a signed token

## Required secrets (MUST match)
- Cloudflare Worker secret: `MEDIA_TOKEN_SECRET`
- Django env: `SIDDES_MEDIA_TOKEN_SECRET`

If these differ (or Django secret is missing), private media will fail.

## Deploy steps (no coding)
1) Go to repo folder:
   - `cd ops/cloudflare/r2_media_worker`

2) Copy config:
   - `cp wrangler.toml.example wrangler.toml`

3) Edit `wrangler.toml` placeholders:
   - `<YOUR_BUCKET_NAME>`
   - `<YOUR_DOMAIN>` (example: `yourdomain.com`)
   - `<YOUR_ZONE_NAME>` (example: `yourdomain.com`)

4) Circle Worker secret:
   - `npx wrangler secret put MEDIA_TOKEN_SECRET`
   - Paste the SAME value you will put in DigitalOcean `SIDDES_MEDIA_TOKEN_SECRET`

5) Deploy:
   - `npx wrangler deploy`

## Routing
In Cloudflare, make sure your domain is proxied (orange cloud), and the Worker route is active for:
- `https://<YOUR_DOMAIN>/m/*`

## Cache behavior
- Public token (`m=pub`): edge cached (immutable)
- Private token (`m=priv`): `private, no-store`
