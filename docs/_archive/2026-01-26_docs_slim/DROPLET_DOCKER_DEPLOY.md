# Siddes backend: Droplet + Docker (production)

This runbook deploys **only** the backend to a Droplet using Docker.
Frontend stays on Vercel.
Media stays on Cloudflare R2 + Worker (/m/*).

## Prereqs
- A Droplet with Docker + Docker Compose plugin installed.
- Cloudflare DNS:
  - `api.siddes.com` A record -> Droplet IP (start with **DNS only**).
- Ports open on the Droplet firewall: 80 and 443.

## 1) Clone repo on Droplet
```bash
mkdir -p /opt/siddes && cd /opt/siddes
git clone https://github.com/cnyakundi/siddessocial.git
cd siddessocial
```

## 2) Create prod env file
```bash
cp ops/docker/.env.prod.example ops/docker/.env.prod
nano ops/docker/.env.prod
```
Fill:
- `DJANGO_SECRET_KEY`
- `SIDDES_CONTACTS_PEPPER`
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`
- `SIDDES_MEDIA_TOKEN_SECRET` (must match Worker `MEDIA_TOKEN_SECRET`)
- Circle `POSTGRES_PASSWORD` and update `DATABASE_URL` to match.

## 3) Start containers
```bash
./scripts/deploy/droplet_docker_up.sh
```

## 4) Verify
```bash
curl -i https://api.siddes.com/healthz
curl -i https://api.siddes.com/readyz
```

## Notes
- The backend container runs `backend/start_prod.sh`, which runs migrations, collectstatic, then gunicorn.
- If you later want Cloudflare proxy (orange cloud) for the API, enable it after Caddy has issued certs.
