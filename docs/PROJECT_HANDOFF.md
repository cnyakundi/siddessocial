# Siddes — Project Handoff (read first)

## What this repo is
**Siddes** is a context-safe social OS:
- Frontend: **Next.js App Router + Tailwind** (`frontend/`)
- Backend: **Django + DRF** (`backend/`)
- Dev/ops tooling: `ops/`, `scripts/`

## Run (Docker dev)
From repo root:

```bash
cd ops/docker
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000

## Quality gate (recommended)
After any meaningful change:

```bash
./verify_overlays.sh
bash scripts/run_tests.sh --smoke
```

## Core invariants (don’t violate)
- **No cross-side leakage** (server-enforced)
- **Default-safe**: if viewer/auth can’t be proven → restricted / no content
- **No user identity in URLs** (no `?viewer=` style params)

## Where to read next
- `docs/README.md` (index)
- `docs/STATE.md` (current status)
- `docs/UI_HEARTBEAT.md` + `docs/UI_MASTER_SPEC.md` (UI laws)
- `docs/DEPLOYMENT_GATES.md` (launch checklist)
