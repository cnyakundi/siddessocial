# E2E Smoke (Playwright)

This repo uses **Playwright** for high-signal end-to-end smoke tests.

## Prereqs

1) Start backend (dev compose)

```bash
docker compose -f ops/docker/docker-compose.dev.yml up -d db redis backend
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate
```

2) Install frontend deps + Playwright browsers

```bash
cd frontend
npm install
npm run e2e:install
```

## Run

```bash
cd frontend
npm run e2e
```

## What it covers

- Auth: signup → onboarding complete → logout → login
- Compose: post text → appears in feed
- Sets: create a set → visible in sets list
- Media (optional): verifies `kind=video` is accepted when R2 is configured

## Notes

- Tests fail fast with a clear message if the backend proxy cannot reach Django.
- Media test auto-skips if the backend returns `r2_not_configured`.
