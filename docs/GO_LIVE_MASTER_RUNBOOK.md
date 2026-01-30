# Siddes Go-Live Master Runbook (DigitalOcean + Vercel + Cloudflare R2)

This is the single “source of truth” for launching Siddes.

## Target topology
- **Frontend**: Vercel (Next.js App Router)
- **Backend**: DigitalOcean (Django/DRF)
- **Media**: Cloudflare R2
- **Media delivery**: Cloudflare Worker (token-gated for private media) routed on `/m/*`
- **Primary domain DNS**: Cloudflare

Why this topology works well:
- Browser talks to Vercel only (same-origin): `/api/*`, `/m/*`
- Vercel server talks to Django (server-to-server)
- Cloudflare Worker serves bytes from R2 (fast + cheap), but **requires tokens** for private media

---

## Step 0 — Domain plan (recommended)
Choose one:

### Option A (simple)
- App: `app.yourdomain.com` -> Vercel
- API: `api.yourdomain.com` -> DigitalOcean
- Media: `app.yourdomain.com/m/*` -> Cloudflare Worker route (path-based)

### Option B (even cleaner separation)
- App: `yourdomain.com` -> Vercel
- API: `api.yourdomain.com` -> DigitalOcean
- Media: `media.yourdomain.com/*` -> Cloudflare Worker route

If you use Option B, update Django to emit media URLs under `https://media.yourdomain.com/...`.

---

## Step 1 — Generate secrets (do this once)
Run the helper:

```bash
chmod +x scripts/generate_prod_secrets.sh
./scripts/generate_prod_secrets.sh
```

Keep these safe:
- `DJANGO_SECRET_KEY`
- `SIDDES_CONTACTS_PEPPER`
- `SIDDES_MEDIA_TOKEN_SECRET` (must match Cloudflare Worker secret)

---

## Step 2 — Backend deploy (DigitalOcean)

### A) Required env vars (minimum)
Circle these in DigitalOcean for the Django service:

- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<generated>`
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com` (no wildcard)
- `DATABASE_URL=<managed postgres url>`

Contacts security:
- `SIDDES_CONTACTS_PEPPER=<generated>`

Media (R2 signing):
- `SIDDES_R2_ACCOUNT_ID=<r2 account id>` OR `SIDDES_R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com`
- `SIDDES_R2_BUCKET=<bucket>`
- `SIDDES_R2_ACCESS_KEY_ID=<key>`
- `SIDDES_R2_SECRET_ACCESS_KEY=<secret>`

Email (pick one):
- SMTP:
  - `SD_EMAIL_PROVIDER=smtp`
  - `SD_EMAIL_FROM=no-reply@yourdomain.com`
  - `SD_SMTP_HOST=...`
  - `SD_SMTP_PORT=587`
  - `SD_SMTP_USER=...`
  - `SD_SMTP_PASSWORD=...`
  - `SD_SMTP_USE_TLS=1`

OR SendGrid:
- `SD_EMAIL_PROVIDER=sendgrid`
- `SD_EMAIL_FROM=no-reply@yourdomain.com`
- `SD_SENDGRID_API_KEY=...`

Public app base (so email links point to your app):
- `SIDDES_PUBLIC_APP_BASE=https://app.yourdomain.com`

### B) Start command
Your backend should run migrations and serve gunicorn. If you used the `sd_385` deploy pack, use:

```bash
./backend/start_prod.sh
```

### C) Health checks
- `GET /healthz` should return ok
- `GET /readyz` should return ready when DB is reachable

---

## Step 3 — Frontend deploy (Vercel)

### Required env vars
Circle these in Vercel:

- `SD_INTERNAL_API_BASE=https://api.yourdomain.com`

Optional but recommended:
- `NEXT_PUBLIC_APP_ORIGIN=https://app.yourdomain.com`

### Verify
After deploy:
- Login/signup should set session cookies
- Feed loads
- Creating a post works

---

## Step 4 — Media go-live (Cloudflare R2 + Worker)

### A) R2 bucket CORS (for browser uploads)
Allow:
- Methods: `PUT, GET, HEAD`
- Origins: your app origin(s) (`https://app.yourdomain.com`, and preview domains if needed)
- Headers: at least `content-type`

### B) Worker deploy (token-gated)
From repo:

```bash
cd ops/cloudflare/r2_media_worker
cp wrangler.toml.example wrangler.toml
# edit placeholders (bucket + zone + route)

npx wrangler secret put MEDIA_TOKEN_SECRET
# paste SAME value as SIDDES_MEDIA_TOKEN_SECRET

npx wrangler deploy
```

### C) Backend env to match Worker
Circle on DigitalOcean:
- `SIDDES_MEDIA_TOKEN_SECRET=<same secret as Worker>`
- Optional: `SIDDES_MEDIA_PRIVATE_TTL=600`

### D) Test matrix
1) Public image post: should load fast and be cacheable
2) Friends/Close/Work image post:
   - allowed viewer can see
   - incognito (no token) must fail

---

## Step 5 — Cloudflare caching rules (recommended)
In Cloudflare Cache Rules:
- **Bypass cache** for `*/api/*`
- **Bypass cache** for `*/m/*` if private tokens are used (Worker already sets no-store for private)

---

## Step 6 — Final preflight checks (local)
Run:

```bash
chmod +x scripts/go_live_preflight.sh
./scripts/go_live_preflight.sh
```

It will:
- run frontend typecheck/build
- run backend checks inside docker (if docker is available)

---

## Rollback strategy
- Vercel: revert to previous deployment
- DigitalOcean: redeploy previous container image / commit
- Cloudflare Worker: rollback to previous version (wrangler keeps history)


\n---\n\n## Post-deploy smoke test (recommended)\n\nAfter Vercel + DigitalOcean are live, run:\n\n```bash\nchmod +x scripts/post_deploy_smoke.sh\n./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com\n```\n

\n---\n\n## PROD_DOMAINS_COOKIES_CSRF\nSee: docs/PROD_DOMAINS_COOKIES_CSRF.md\n
