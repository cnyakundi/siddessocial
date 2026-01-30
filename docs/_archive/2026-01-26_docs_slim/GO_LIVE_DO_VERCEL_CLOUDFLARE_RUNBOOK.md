# Siddes Go-Live Runbook (DigitalOcean + Vercel + Cloudflare R2)

This repo is designed for **Browser -> Vercel (Next) -> Next /api proxies -> DigitalOcean (Django/DRF)**.

**Production rule:** the browser should talk to **Vercel only**. Vercel talks to Django server-to-server.

---

## Target Architecture

- **Frontend**: Vercel (Next.js)
- **API**: DigitalOcean (Django + DRF)
- **Database**: DigitalOcean Managed Postgres
- **Media storage**: Cloudflare R2
- **Media delivery (go-live safe default)**: Vercel `/m/*` -> Django signs -> redirect to R2 (short-lived)

---

## Go-Live Checklist

### P0 (must be done before you announce)
- [ ] **Vercel env set**: `SD_INTERNAL_API_BASE=https://<your-backend-domain>`
- [ ] **Django env set**: `DJANGO_DEBUG=0`, strong `DJANGO_SECRET_KEY`, strict `DJANGO_ALLOWED_HOSTS` (no `*`), `DJANGO_CSRF_TRUSTED` includes your Vercel/custom domain, `SIDDES_CONTACTS_PEPPER` set, `DATABASE_URL` set
- [ ] **Backend runs gunicorn** (this pack adds `backend/start_prod.sh` + `backend/gunicorn.conf.py`)
- [ ] **R2 bucket + CORS** allows browser `PUT` uploads from your Vercel domain
- [ ] **Migrations run** on DigitalOcean (`python manage.py migrate`)

### P1 (recommended next)
- [ ] If you front media with a Cloudflare Worker, **token-gate private media** (do not public-cache private-side files)
- [ ] Add Redis (optional) for shared throttles/caches if you run multiple backend instances

---

## 1) Cloudflare R2 (media)

1. Create an R2 bucket (example): `siddes-media`
2. Create an API token / access key scoped to that bucket
3. Circle R2 CORS (required for uploads):
   - Methods: `PUT, GET, HEAD`
   - Origins: your Vercel domain(s)
   - Headers: `content-type`

---

## 2) Deploy Django on DigitalOcean

### Recommended: DigitalOcean App Platform
- Service root: `backend/`
- Start command:

```
./start_prod.sh
```

### Health check
- Path: `/healthz`

### Required environment variables (DigitalOcean)
Use `ops/deploy/backend.env.prod.example` as your template.

Minimum required:
- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<strong secret >= 32 chars>`
- `DJANGO_ALLOWED_HOSTS=<your DO backend domain or api.yourdomain>`
- `DJANGO_CSRF_TRUSTED=https://<your vercel domain>,https://<your custom domain>`
- `DATABASE_URL=postgres://...`
- `SIDDES_CONTACTS_PEPPER=<strong secret >= 32 chars>`

R2 signing:
- `SIDDES_R2_BUCKET`
- `SIDDES_R2_ACCOUNT_ID` (or `SIDDES_R2_ENDPOINT`)
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`

### One-time backend smoke test

```
curl -i https://<your-backend-domain>/healthz
```

---

## 3) Deploy Next.js on Vercel

### Required environment variable (Vercel)
Use `ops/deploy/vercel.env.example` as your template.

- `SD_INTERNAL_API_BASE=https://<your-backend-domain>`

### One-time frontend smoke test

```
curl -i https://<your-vercel-domain>/api/auth/me
curl -i https://<your-vercel-domain>/api/_diag
```

Expected: `200 OK` and JSON with `authenticated:false` when logged out.

Then verify: `/api/_diag` returns `ok:true` and shows your configured backend origin.

---

## 4) Cloudflare DNS (recommended)

Typical clean setup:
- `yourdomain.com` -> Vercel
- `api.yourdomain.com` -> DigitalOcean backend

If you use `api.yourdomain.com`, set:
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com`
- `SD_INTERNAL_API_BASE=https://api.yourdomain.com` (on Vercel)

---

## 5) App-level go-live smoke tests (manual)

1) Sign up + verify email (or login)
2) Create a text post (all Sides)
3) Like / reply / echo a post
4) Create a Circle + post to it
5) If you applied `sd_384` (media): upload an image, confirm it renders in feed + detail

---

## Notes

- If CSRF errors happen on production logins/posts, it almost always means your Vercel/custom domain is missing from `DJANGO_CSRF_TRUSTED`.
- This repo already includes `ops/cloudflare/r2_media_worker/` for future media caching, but do not cache private media publicly.
