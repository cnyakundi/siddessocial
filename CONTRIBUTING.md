# Contributing to Siddes

Thanks for helping build **Siddes**.

## Local dev (Docker)
From repo root:

```bash
cd ops/docker
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## Checks
From repo root:

```bash
npm run typecheck
npm run build
```

## Principles
- **No cross-side leakage** (server-side enforcement, deny by default)
- **Server truth > client illusion** (session auth is authoritative)
- **No unfinished features in production paths** (dev-only gates allowed)

## What not to commit
- `.env` files or secrets
- `node_modules`, `.next`, `.next_build`, build output
- `.backup_*` scratch/patch backups
