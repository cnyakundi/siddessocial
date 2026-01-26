# Siddes Go-Live (No-Code ClickOps Runbook)
**Target stack:** Vercel (frontend) + DigitalOcean (Django backend) + Cloudflare R2 (media)  
Optional: Cloudflare Worker for `/m/*` edge media.

This runbook is written for a non-coder: you mostly click in dashboards and copy/paste env vars.

---

## 0) Decide your domain plan (recommended)
Pick a single base domain, then:

- **App (Vercel):** `app.yourdomain.com`
- **API (DigitalOcean):** `api.yourdomain.com`
- **Media (path):** keep `/m/*` on the app domain (simplest)  
  - Later (optional): run Cloudflare Worker on `/m/*` for edge delivery

Why this plan works well:
- The browser only talks to **one origin** (`app.yourdomain.com`)
- All API calls go through **Next `/api/*`**, proxying to Django
- Cookies + CSRF become much simpler

---

## 1) Cloudflare DNS + SSL (one-time)
1) Add your domain in Cloudflare and switch nameservers at your registrar.
2) Cloudflare → **SSL/TLS**
   - Set mode to **Full (strict)** (recommended)
3) Cloudflare → **DNS**
   Create records (you’ll finalize targets after you set up Vercel/DO):

### 1A) Vercel app record
- Type: `CNAME`
- Name: `app`
- Target: `cname.vercel-dns.com`
- Proxy status: start with **DNS only** (grey cloud).  
  After everything works, you can enable proxy if you want Cloudflare in front.

### 1B) DigitalOcean API record
DigitalOcean will show you what record to create when you add a custom domain to the DO app.
Usually you’ll create either:
- `CNAME api -> <your-app>.ondigitalocean.app`  (common)
OR
- `A api -> <IP from DO>` (if DO gives you a fixed IP)

Start with **DNS only** for the API too (grey cloud). After the app is stable, you can proxy it if you want.

---

## 2) Cloudflare R2 bucket (media storage)
1) Cloudflare dashboard → R2 → Create bucket (example name: `siddes-media`)
2) Create an **R2 API token** / access keys (S3-compatible credentials)
3) Set **CORS** on the bucket so browsers can upload:

Allow origins:
- `https://app.yourdomain.com`
- (and your Vercel preview domains if needed)

Allow methods:
- `PUT, GET, HEAD`

Allow headers:
- at least `content-type`

---

## 3) DigitalOcean (backend) deployment (App Platform recommended)
### 3A) Create backend app
1) DigitalOcean → **Apps** → Create App
2) Source: GitHub repo (the Siddes repo)
3) **Source directory:** set to `backend` (important)
4) Build command:
- `pip install -r requirements.txt`

5) Run command (pick one that exists in your repo):
- If `backend/start_prod.sh` exists: `./start_prod.sh`
- Otherwise: `gunicorn siddes_backend.wsgi:application`

### 3B) Add database + redis (recommended)
- Add Managed Postgres; wire `DATABASE_URL`
- Add Managed Redis; wire `REDIS_URL` (strongly recommended for rate limits)

### 3C) Add environment variables (copy/paste)
In your repo:
- `ops/deploy/backend.env.prod.example`

Copy that into DigitalOcean env vars, then customize these fields:
- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<strong secret>`
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com`
- `DJANGO_CSRF_TRUSTED=https://app.yourdomain.com`
- `SIDDES_PUBLIC_APP_BASE=https://app.yourdomain.com`

R2 vars (must match your R2 keys/bucket):
- `SIDDES_R2_BUCKET=...`
- `SIDDES_R2_ACCESS_KEY_ID=...`
- `SIDDES_R2_SECRET_ACCESS_KEY=...`
- `SIDDES_R2_ACCOUNT_ID=...` (or endpoint)

Email vars (choose one provider):
- SMTP or SendGrid (see `ops/deploy/backend.env.prod.example`)

### 3D) Attach custom domain for API
In DigitalOcean App → Settings → Domains:
- Add `api.yourdomain.com`
- DO will tell you the DNS record to create/update in Cloudflare

### 3E) One-time backend commands (run in DO console)
After the app is deployed:
- `python manage.py migrate`
- `python manage.py createsuperuser`
- `python manage.py launch_check --strict`  (must say SAFE TO SHIP)

**Health checks you should be able to open in a browser:**
- `https://api.yourdomain.com/healthz`
- `https://api.yourdomain.com/readyz`

---

## 4) Vercel (frontend) deployment
### 4A) Create project
1) Vercel → New Project → Import your GitHub repo
2) **Root Directory:** `frontend` (important)
3) Build: `npm run build` (default is fine for Next)

### 4B) Add environment variables
Set:
- `SD_INTERNAL_API_BASE=https://api.yourdomain.com`

(If you have a `vercel.env.example`, copy from it.)

### 4C) Add custom domain
Vercel → Project → Domains:
- Add `app.yourdomain.com`
- Vercel will validate the DNS (your Cloudflare CNAME should already point to `cname.vercel-dns.com`)

---

## 5) Media delivery option (choose ONE)
### Option A (recommended first launch): keep `/m/*` on Vercel (Next)
If your media pipeline is wired, `/m/<key>` requests go to Next, which returns a short-lived signed redirect to R2.
- Simplest
- Safe for private media
- Fewer moving parts

### Option B (edge): Cloudflare Worker for `/m/*`
Only do this if you **must** serve media from Cloudflare edge immediately.

Requirements:
- Worker validates token in `?t=...`
- Private media tokens are short-lived and `no-store`

Your repo should include:
- `ops/cloudflare/r2_media_worker/`

Steps:
1) `cd ops/cloudflare/r2_media_worker`
2) `cp wrangler.toml.example wrangler.toml`
3) Edit placeholders in `wrangler.toml`
4) Set secret:
   - `npx wrangler secret put MEDIA_TOKEN_SECRET`
5) Deploy:
   - `npx wrangler deploy`

Then, set on DigitalOcean backend:
- `SIDDES_MEDIA_TOKEN_SECRET=<same as MEDIA_TOKEN_SECRET>`
- optional `SIDDES_MEDIA_PRIVATE_TTL=600`

Finally, in Cloudflare add a Worker route:
- `https://app.yourdomain.com/m/*`  (only works if app domain is proxied through Cloudflare)

If this is confusing: use Option A for launch.

---

## 6) Post-deploy smoke test (fast confidence)
If your repo includes `scripts/post_deploy_smoke.sh`:
```bash
chmod +x scripts/post_deploy_smoke.sh
./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com
```

What you want:
- `/api/health` ok
- `/api/auth/me` returns JSON
- `/api/feed?side=public&limit=1` returns JSON
- You can log in and create a post

---

## 7) Launch day checklist
- Backend: `launch_check --strict` returns SAFE TO SHIP
- Vercel: build is green, domain is verified
- R2: CORS set, keys in DO env vars, image upload works
- Smoke test passes
- You tested on mobile + desktop
