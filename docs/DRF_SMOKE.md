# DRF Smoke Test (Fast)

This is the **fastest proof** that the Django backend is up and the Inbox endpoints work.

## 1) Start the stack (Docker)

From repo root:

```bash
chmod +x scripts/dev/start_full_stack_docker.sh
./scripts/dev/start_full_stack_docker.sh
```

## 2) Run the smoke test (seconds)

```bash
bash scripts/dev/drf_smoke.sh
```

### Optional knobs

```bash
VIEWER=me SIDE=Friends LIMIT=5 bash scripts/dev/drf_smoke.sh
VIEWER=me SIDE=Public  LIMIT=5 bash scripts/dev/drf_smoke.sh
```

If you see **"No threads returned"**, it usually means the backend is running but your viewer is restricted.
Try `VIEWER=me SIDE=Public`.

## What it checks

- `GET /healthz` responds
- `GET /api/inbox/threads` returns JSON
- It extracts a thread id and fetches `GET /api/inbox/thread/<id>`
- Validates the payload is contract-shaped

This is designed to fail fast so you don't waste time waiting for long builds.

## Posts + Replies smoke (fast)

This is the fastest proof that **Posts + Replies** endpoints work in Docker.

1) Start the stack (Docker)

```bash
chmod +x scripts/dev/start_full_stack_docker.sh
./scripts/dev/start_full_stack_docker.sh
```

2) Run the Posts smoke test (seconds)

```bash
VIEWER=me BASE="http://localhost:${SIDDES_BACKEND_PORT:-8000}" bash scripts/dev/posts_drf_smoke.sh
```

If you see **restricted** or 401/403 errors, you likely don't have a viewer identity.
Use `VIEWER=me` (dev mode) and make sure the backend is reachable at `BASE`.

## Posts DB mode (optional)

To verify **persistence** (survives restart), enable the DB-backed store.

1) Run migrations (Docker)
```bash
bash scripts/dev/django_migrate.sh
```

2) Set store mode (recommended: auto)
Edit `ops/docker/.env` and set:
```bash
SD_POST_STORE=auto
```

3) Restart backend
```bash
docker compose -f ops/docker/docker-compose.dev.yml up -d backend
```

4) Run Posts smoke
```bash
VIEWER=me BASE="http://localhost:${SIDDES_BACKEND_PORT:-8000}" bash scripts/dev/posts_drf_smoke.sh
```

If you restart the stack and the post/replies still exist, DB mode is working.

## Posts DB persistence smoke (survives restart)

This proves Posts+Replies are stored in the database (not in-memory):

```bash
# 1) Run migrations (Docker)
bash scripts/dev/django_migrate.sh

# 2) Enable DB store (recommended: auto)
# edit ops/docker/.env and set:
# SD_POST_STORE=auto

# 3) Start / restart the stack
./scripts/dev/start_full_stack_docker.sh

# 4) Run the persistence smoke test
VIEWER=me BASE="http://localhost:${SIDDES_BACKEND_PORT:-8000}" bash scripts/dev/posts_db_persistence_smoke.sh
```

If you see a 404 after restart, you're still in memory mode.

## Smoke scripts auto-detect Docker ports (sd_147a)

If you start the stack with Docker, the smoke scripts will auto-read `ops/docker/.env` (or `.env.example`) so you usually **do not** need to set `BASE` manually:

```bash
# Start stack
./scripts/dev/start_full_stack_docker.sh

# Posts smoke (fast)
VIEWER=me bash scripts/dev/posts_drf_smoke.sh

# Posts persistence smoke (requires SD_POST_STORE=auto + migrations)
VIEWER=me bash scripts/dev/posts_db_persistence_smoke.sh
```

If your backend uses a non-default port, set `SIDDES_BACKEND_PORT` in `ops/docker/.env`.
