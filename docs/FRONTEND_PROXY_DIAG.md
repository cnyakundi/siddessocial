# Frontend Proxy Origin (SD_INTERNAL_API_BASE) + /api/_diag

This repo uses **same-origin Next.js API routes** under `/api/*` that **proxy** to Django.

The browser should talk to **Vercel only**.
Vercel talks server-to-server to Django.

## Required in production

On **Vercel**, set:

- `SD_INTERNAL_API_BASE=https://<your-backend-domain>`

If you forget this, most `/api/*` calls will return:

- `{ ok:false, error:"backend_not_configured" }`

## Recommended values

Typical setup:

- Frontend: `https://app.yourdomain.com` (Vercel)
- Backend: `https://api.yourdomain.com` (DigitalOcean)

So:

- `SD_INTERNAL_API_BASE=https://api.yourdomain.com`

## Debugging

### 1) Check proxy configuration

Hit the diag endpoint:

- `GET /api/_diag`

Expected (good):
- `ok: true`
- `resolved.chosenBase` is your backend origin
- `healthz.ok: true`

If `ok:false`:
- If `chosenBase` is empty → env var missing on Vercel
- If `chosenBase` exists but `healthz.ok:false` → backend is down/unreachable

### 2) Check backend health directly

- `GET https://<your-backend-domain>/healthz` should be `200`.

## Notes

- In **dev**, proxies can auto-detect the backend (`backend:8000`, `127.0.0.1:8000`, etc.).
- In **production**, auto-detection is disabled. It fails closed for safety.
