# Deploy Automation (Siddes.com)

This repo supports one-command deployment setup:

- Frontend (Next.js) on **Vercel**: `app.siddes.com`
- Backend (Django) on **DigitalOcean App Platform**: `api.siddes.com`
- Media served via Cloudflare Worker: `app.siddes.com/m/*`

## Prereqs

1) Repo is pushed to GitHub and has `origin` set.
2) You have CLIs installed and authenticated:

- Vercel CLI: `vercel login`
- DigitalOcean CLI: `doctl auth init`

> DigitalOcean App Platform must be granted access to your GitHub repo in the DO dashboard once.

## Step 1: Fill DO secrets (local file, not committed)

Copy and fill:

```bash
cp ops/deploy/backend.env.prod.local.example ops/deploy/backend.env.prod.local
# edit ops/deploy/backend.env.prod.local and fill values
```

Required keys:
- `DJANGO_SECRET_KEY`
- `SIDDES_CONTACTS_PEPPER`
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`
- `SIDDES_MEDIA_TOKEN_SECRET` (must match Cloudflare Worker `MEDIA_TOKEN_SECRET`)

## Step 2: Deploy everything

```bash
./scripts/deploy/deploy_all.sh
```

## DNS checklist (Cloudflare)

### Vercel
- `app.siddes.com` -> CNAME to `cname.vercel-dns.com` (Vercel will also show this)

### DigitalOcean
- `api.siddes.com` -> CNAME to the `DefaultIngress` shown by `doctl` (e.g. `xxxx.ondigitalocean.app`)

## After DNS

- Verify:
  - `https://app.siddes.com/api/health`
  - Upload a photo in Composer
  - Media loads from `https://app.siddes.com/m/<key>`
