# Post-Deploy Smoke Test (Vercel + DigitalOcean)

This is a zero-guessing check you can run after you deploy.

## Run

```bash
chmod +x scripts/post_deploy_smoke.sh
./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com
```

## Optional media test
After you create an image post, copy its image URL (it will look like `/m/<key>?t=<token>`), then run:

```bash
MEDIA_TEST_URL="https://app.yourdomain.com/m/<key>?t=<token>" \
  ./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com
```

## What it checks
- Django: `/healthz` and `/readyz`
- Next: `/api/health` (Next -> Django connectivity)
- Auth endpoints exist: `/api/auth/me`, `/api/auth/csrf`
- Feed endpoint is reachable and returns JSON: `/api/feed?side=public&limit=1`

If any step fails, it prints the response body so you can debug immediately.
