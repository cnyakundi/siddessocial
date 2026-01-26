# SIDDES MIGRATION PACK (copy into a new chat window)

## Project
**Siddes** — Next.js PWA (frontend) + **Django backend (Django REST Framework / DRF)** + overlay zip workflow.

## Repo root (local)
`/Users/cn/Downloads/sidesroot`

## Workflow (every overlay)
```bash
cd /Users/cn/Downloads/sidesroot
chmod +x scripts/apply_overlay.sh
./scripts/apply_overlay.sh ~/Downloads/<zip>
./verify_overlays.sh
./scripts/run_tests.sh
```

## Canonical docs (read in this order)
1. `docs/STATE.md` (current + NEXT)
2. `docs/OVERLAYS_INDEX.md` (applied order)
3. `docs/PHASES.md`
4. `docs/OVERLAY_WORKFLOW.md`
5. `docs/INBOX_BACKEND_CONTRACT.md`
6. `docs/AUTH.md` (dev auth skeleton + production posture)

## One-command full product (beginner-safe)
1) Make sure **Docker Desktop** is running  
2) Run:

```bash
cd /Users/cn/Downloads/sidesroot
chmod +x scripts/dev/start_full_stack_docker.sh
./scripts/dev/start_full_stack_docker.sh
```

The script auto-picks ports if `3000` / `8000` are busy and prints URLs.


## PWA phone install test (HTTPS) — sd_734_pwa_phone_test
To make Siddes feel like a real mobile app, you need to open it on your phone **over HTTPS** and install it from the home screen.

Beginner-safe helper:

```bash
cd /Users/cn/Downloads/sidesroot
chmod +x scripts/dev/pwa_phone_test.sh
PORT=3000 ./scripts/dev/pwa_phone_test.sh
```

Then open the printed **https://** URL on your phone:
- **iPhone/iPad:** Safari → Share → Add to Home Screen
- **Android:** Chrome → Install app

Notes:
- This runs a **production** Next.js server locally (service worker + install/update banners are production-only).
- `npx localtunnel` downloads on first run and needs internet access.


## Inbox: what matters architecturally
- **Sides are modes** (Public/Friends/Close/Work). Context is always visible in the UI.
- **Default-safe backend**: if viewer cannot be confidently authorized → `restricted: true` and **no content**.
- **Viewer identity is NOT allowed in URLs**:
  - `?viewer=` is ignored (even in dev).
  - Dev viewer comes from **header** `x-sd-viewer` or cookie `sd_viewer`.
  - In production (`DJANGO_DEBUG=0`), dev headers/cookies are ignored (requires real auth later).
- **Provider pattern**: frontend can swap data sources without rewriting UI:
  - `inboxProvider` (mock vs backend_stub)
  - backend_stub talks to Django via `NEXT_PUBLIC_API_BASE` when running Docker.

## Backend API (DRF)
Inbox endpoints (contract in `docs/INBOX_BACKEND_CONTRACT.md`):
- `GET  /api/inbox/threads`
- `GET  /api/inbox/thread/<id>`
- `POST /api/inbox/thread/<id>` (send / move side)
Dev-only debug:
- `POST /api/inbox/debug/unread/reset`
- `POST /api/inbox/debug/incoming`

## Store modes (dev)
- Default: `SD_INBOX_STORE=memory` → seeded in-memory demo store
- Optional: `SD_INBOX_STORE=memory` + `SD_INBOX_DUALWRITE_DB=1` → memory reads, DB shadow writes (best-effort)
- Optional: `SD_INBOX_STORE=db` → DB-backed store (requires migrations + seed)
  - Recommended one-command setup:
    ```bash
    bash scripts/dev/inbox_db_seed.sh --switch
    ```
  - Manual alternative:
    1) `bash scripts/dev/django_migrate.sh`
    2) `python manage.py seed_inbox_demo --reset` (inside Docker backend container)
    3) set `SD_INBOX_STORE=db` in `ops/docker/.env` and restart backend

## Fast-fail smoke tests (seconds)
```bash
bash scripts/dev/drf_smoke.sh
```

## Inbox store (recommended dev default)
- Full guide: `docs/INBOX_DB.md`
- For Docker dev, the single best default is:
  - `SD_INBOX_STORE=auto` (prefer DB when available, fallback to memory)
- One-command setup (migrate + seed demo inbox + set env when needed):
```bash
bash scripts/dev/inbox_store_auto.sh --seed-db
```

## If you need to move to a new chat window
### 1) Create a “current status” zip (source of truth)
```bash
cd /Users/cn/Downloads/sidesroot
zip -r ../sidesroot_status_$(date +%Y%m%d_%H%M).zip .   -x "frontend/node_modules/*"   -x "frontend/.next/*"   -x "frontend/.next/cache/*"   -x "backend/.venv/*"   -x "**/__pycache__/*"   -x ".git/*"
```

### 2) Upload the zip to the new chat and say
“Read `docs/STATE.md` + `docs/OVERLAYS_INDEX.md` and continue from NEXT.”
