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
