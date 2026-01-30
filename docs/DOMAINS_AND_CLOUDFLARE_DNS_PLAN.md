# Domains + Cloudflare DNS Plan (Siddes Go-Live)

This is a **no-code** checklist to set up:
- Vercel (frontend)
- DigitalOcean App Platform (Django backend)
- Cloudflare (DNS, SSL, optional Worker for `/m/*`)
- Cloudflare R2 (media storage)

> **Recommended (simple) plan:**  
> `app.yourdomain.com` = Vercel  
> `api.yourdomain.com` = DigitalOcean  
> Media = keep `/m/*` on the app domain (Vercel) for launch

---

## 1) Pick your canonical hostnames
Decide your base domain: `yourdomain.com`

Use:
- **App:** `app.yourdomain.com`
- **API:** `api.yourdomain.com`

Why:
- Browser only talks to **app** (one origin)
- Next proxies `/api/*` to your Django API
- Cookies and CSRF are predictable

---

## 2) Cloudflare: SSL/TLS settings
Cloudflare → SSL/TLS:
- Circle **SSL mode** to **Full (strict)** (recommended)
- Leave HSTS off until everything is stable (you can add later)

---

## 3) Cloudflare DNS records (what to create)

### 3A) App record (Vercel)
Create:

- Type: **CNAME**
- Name: **app**
- Target: **cname.vercel-dns.com**
- Proxy status: **DNS only** (grey cloud) for first launch

Notes:
- Vercel will also show you the correct record once you add the domain in Vercel.
- After everything is stable, you can turn proxy ON if you want Cloudflare in front of the app.

### 3B) API record (DigitalOcean)
You cannot know the exact target until you add the domain in DigitalOcean.

Do this:
1) DigitalOcean App → Settings → Domains → Add `api.yourdomain.com`
2) DO will show you the required DNS record

Then create the record in Cloudflare exactly as DO says (usually one of these):
- **CNAME** `api` → `<something>.ondigitalocean.app`  (common)
OR
- **A** `api` → `<some IP>` (less common)

For first launch: keep proxy **DNS only** (grey cloud).  
(Cloudflare proxy in front of API can complicate debugging until stable.)

---

## 4) Vercel domain setup (frontend)
Vercel → Project → Settings → Domains:
- Add: `app.yourdomain.com`
- Vercel will validate your DNS (CNAME above)

Vercel environment variables (required):
- `SD_INTERNAL_API_BASE=https://api.yourdomain.com`

---

## 5) DigitalOcean domain setup (backend)
DigitalOcean → App → Settings → Domains:
- Add: `api.yourdomain.com`

DigitalOcean environment variables (minimum):
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com`
- `DJANGO_CSRF_TRUSTED=https://app.yourdomain.com`
- `SIDDES_PUBLIC_APP_BASE=https://app.yourdomain.com`

Also set your DB/Redis/R2/email vars from:
- `ops/deploy/backend.env.prod.example`

---

## 6) Media delivery: choose ONE route

### Option A (recommended first launch): keep `/m/*` on Vercel
- Media URLs look like: `https://app.yourdomain.com/m/<key>`
- Next redirects to short-lived signed R2 URLs
- Works even if Cloudflare proxy is OFF

✅ simplest, safest launch.

### Option B (edge): Cloudflare Worker serves `/m/*`
Only do this after Option A works, or if you really need edge media.

Requires:
- app domain must be proxied (orange cloud) so Worker routes apply
- Worker secret `MEDIA_TOKEN_SECRET` must match backend `SIDDES_MEDIA_TOKEN_SECRET`

Steps:
1) Deploy worker from `ops/cloudflare/r2_media_worker`
2) Add Worker route: `https://app.yourdomain.com/m/*`
3) Turn proxy ON for `app` record in Cloudflare
4) Circle `SIDDES_MEDIA_TOKEN_SECRET` on DigitalOcean backend to the same value

---

## 7) “Are we live?” quick checks
Once deployed, open in browser:

Backend:
- `https://api.yourdomain.com/healthz`
- `https://api.yourdomain.com/readyz`

Frontend:
- `https://app.yourdomain.com`

Then run smoke test (if present):
```bash
chmod +x scripts/post_deploy_smoke.sh
./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com
```

If healthz is green but the app can’t log in / post:
- check `SD_INTERNAL_API_BASE` on Vercel
- check `DJANGO_CSRF_TRUSTED` on DigitalOcean
- check cookie domain settings (only needed if you share cookies across subdomains)
