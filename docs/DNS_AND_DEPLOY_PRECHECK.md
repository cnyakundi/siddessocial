# DNS + Deploy Precheck (Siddes)

If your smoke test shows:
- `curl: (6) Could not resolve host: api.siddes.com`

That is a **DNS problem**, not a backend code problem.

## Quick fix steps (Cloudflare + DigitalOcean + Vercel)

### 1) Vercel (App domain)
Cloudflare → DNS:
- CNAME `app` → `cname.vercel-dns.com`
- Proxy: **DNS only** for first launch

Vercel → Domains:
- Add `app.siddes.com` to your project

### 2) DigitalOcean (API domain)
DigitalOcean App → Settings → Domains:
- Add `api.siddes.com`
DigitalOcean will show you an exact DNS record to create in Cloudflare.

Cloudflare → DNS:
- Create exactly what DigitalOcean shows
- Proxy: **DNS only** for first launch

### 3) Re-run the preflight
From repo root:
```bash
./scripts/dns_and_http_preflight.sh siddes.com
```

### 4) Re-run smoke
```bash
./scripts/post_deploy_smoke_dns.sh https://app.siddes.com https://api.siddes.com
```

Once `healthz` is 200 and both domains resolve, your deployment plumbing is correct.
