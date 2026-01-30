# Production Domains, Cookies, and CSRF (Go-Live)

This repo uses a safe proxy pattern:

- Browser talks only to **Vercel** (Next.js)
- Next.js `/api/*` routes proxy server-to-server to **Django**
- Django sets session + CSRF cookies, delivered to the browser via the Next proxy

This means:
- `DJANGO_CSRF_TRUSTED` must include your **Vercel app origin**
- `DJANGO_ALLOWED_HOSTS` must be explicit (no `*`) in production

## Recommended domains
Use subdomains on the same apex domain:

- App (Vercel): `https://app.example.com`
- API (DigitalOcean): `https://api.example.com`

## DigitalOcean (Django) env vars
Circle on your Django service:

- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<strong 32+ chars>`
- `DJANGO_ALLOWED_HOSTS=api.example.com`
- `DJANGO_CSRF_TRUSTED=https://app.example.com`

Strongly recommended (email links):
- `SIDDES_PUBLIC_APP_BASE=https://app.example.com`

Optional (only if you use a custom domain like *.example.com):
- `SIDDES_COOKIE_DOMAIN=.example.com` (share cookies across subdomains)

## Vercel env vars
Circle on Vercel:

- `SD_INTERNAL_API_BASE=https://api.example.com`

## Validate before launch
On the backend:

```bash
python manage.py launch_check --strict
```

Expected: **SAFE TO SHIP**
