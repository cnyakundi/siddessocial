# Siddes

Siddes is a **context-safe social OS** built around 4 persistent social contexts called **Sides**:

- **Public** (blue)
- **Friends** (emerald)
- **Close** (rose)
- **Work** (slate)

**Non-negotiables**
- **Server truth > client illusion**: auth/session on the server is the source of truth.
- **No cross-side leakage**: backend enforces Side + Set rules (deny by default).
- **Hide unfinished features in production**: dev tooling and dev-only UI must not be reachable in prod builds.

## Repo layout
- `frontend/` — Next.js App Router + Tailwind UI
- `backend/` — Django + DRF API
- `ops/` — docker/dev tooling
- `docs/` — living documentation (start here)

## Run (Docker dev)
From repo root:
```bash
cd ops/docker
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## Docs (start here)
- `docs/README.md` — documentation index
- `docs/SIDDES_BOOK.md` — consolidated “one doc” overview
- `docs/DEPLOYMENT_GATES.md` — launch readiness checklist (P0/P1/P2)

## Production note
The Dockerfiles under `ops/docker/` are **dev-first** (runserver + `npm run dev`).
For a real deployment you’ll typically want:
- backend served by gunicorn/uvicorn (and proper `DJANGO_DEBUG=0`, strong secrets)
- frontend built (`npm run build`) and served via `npm run start` or a hosting platform

See `docs/DEPLOYMENT_GATES.md` for hard gates.
