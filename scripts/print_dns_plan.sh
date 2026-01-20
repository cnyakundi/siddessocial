#!/usr/bin/env bash
set -euo pipefail

BASE_DOMAIN="${1:-}"
if [ -z "${BASE_DOMAIN}" ]; then
  echo "Usage: ./scripts/print_dns_plan.sh yourdomain.com"
  exit 1
fi

APP="app.${BASE_DOMAIN}"
API="api.${BASE_DOMAIN}"

cat <<EOF
Siddes Domain Plan
==================
App (Vercel): ${APP}
API (DigitalOcean): ${API}

Cloudflare DNS records (starter)
--------------------------------
1) app CNAME:
   - Name: app
   - Type: CNAME
   - Target: cname.vercel-dns.com
   - Proxy: DNS only (grey cloud) for first launch

2) api record:
   - Add domain in DigitalOcean first (api.${BASE_DOMAIN})
   - DigitalOcean will show you the exact DNS record to create in Cloudflare
   - Create it exactly as shown, start with DNS only

Notes
-----
- Keep /m/* served by Vercel for launch (simplest)
- If you later route /m/* to Cloudflare Worker, you'll need app proxied (orange cloud)
EOF
