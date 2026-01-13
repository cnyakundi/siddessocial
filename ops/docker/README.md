# Siddes Docker Dev
**Updated:** 2026-01-09

This is an optional dev environment that runs:
- Postgres
- Redis
- Django backend
- Next.js frontend

## Start
From repo root:
```bash
cd ops/docker
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## Stop
```bash
docker compose -f docker-compose.dev.yml down
```

## Run backend commands
```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.dev.yml exec backend python manage.py test
```

## Run frontend commands
```bash
docker compose -f docker-compose.dev.yml exec frontend npm run lint
docker compose -f docker-compose.dev.yml exec frontend npm run build
```

## API base variables

When running full-stack Docker, there are **two** different "API base" concepts:

- `NEXT_PUBLIC_API_BASE` (public): used by the **browser** (your laptop) to call the backend, e.g. `http://localhost:8001`
- `SD_INTERNAL_API_BASE` (internal): used by the **frontend container** for server-side route handlers, e.g. `http://backend:8000`

Why both?
- In Docker, `localhost` inside the frontend container is **not** your laptop.
- `SD_INTERNAL_API_BASE` avoids "can't connect" errors for server-side proxies.

Recommended values (dev):
- `NEXT_PUBLIC_API_BASE=http://localhost:${SIDDES_BACKEND_PORT}`
- `SD_INTERNAL_API_BASE=http://backend:8000`
