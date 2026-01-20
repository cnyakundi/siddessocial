# Cloudflare Worker setup (Media)

This repo includes a token-gated R2 media Worker at:
- `ops/cloudflare/r2_media_worker/`

## Deploy (no coding)
```bash
cd ops/cloudflare/r2_media_worker
cp wrangler.toml.example wrangler.toml
# edit bucket + route placeholders

npx wrangler secret put MEDIA_TOKEN_SECRET
# paste SAME value as SIDDES_MEDIA_TOKEN_SECRET on DigitalOcean

npx wrangler deploy
```

## Route
Route either:
- `https://app.yourdomain.com/m/*`
OR
- `https://media.yourdomain.com/*`

## Important
If the Worker secret and Django secret do not match, private media will fail.
