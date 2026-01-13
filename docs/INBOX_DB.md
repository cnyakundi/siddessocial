# Inbox store modes (memory / db / auto)
**Updated:** 2026-01-11

This doc explains how to run the **Django DRF Inbox backend** in development using:
- an in-memory store (default)
- a Postgres-backed store
- an auto mode that prefers Postgres when available

This only affects the **backend store implementation**. The frontend contract stays the same (see `docs/INBOX_BACKEND_CONTRACT.md`).

---

## TL;DR

### Recommended (fastest): AUTO mode
AUTO prefers DB when migrations exist and Postgres is reachable.

```bash
bash scripts/dev/inbox_store_auto.sh --seed-db
```

### Explicit DB mode
```bash
bash scripts/dev/inbox_db_seed.sh --switch
```

### Explicit memory mode
Do nothing (default), or set:
```bash
# ops/docker/.env
SD_INBOX_STORE=memory
```

---

## Environment toggles

Set these in `ops/docker/.env` (Docker dev backend reads this file).

### `SD_INBOX_STORE`
Values:
- `memory` (default)
- `db`
- `auto`

Examples:
```bash
SD_INBOX_STORE=memory
# or
SD_INBOX_STORE=db
# or
SD_INBOX_STORE=auto
```

### `SD_INBOX_DUALWRITE_DB` (optional)
If you want **memory reads** while you quietly populate the DB:

```bash
SD_INBOX_STORE=memory
SD_INBOX_DUALWRITE_DB=1
```

In dual-write mode:
- reads come from memory
- writes mirror to DB best-effort

---

## DB store setup

### One-command seed + switch (recommended)
This runs migrations, seeds deterministic inbox rows, sets `SD_INBOX_STORE=db`, and restarts backend:

```bash
bash scripts/dev/inbox_db_seed.sh --switch
```

### Manual DB setup
1) Migrate:
```bash
bash scripts/dev/django_migrate.sh
```

2) Seed inside Docker backend:
```bash
docker compose -f ops/docker/docker-compose.dev.yml run --rm backend python manage.py seed_inbox_demo --reset
```

3) Set store + restart backend:
```bash
# ops/docker/.env
SD_INBOX_STORE=db
```

```bash
docker compose -f ops/docker/docker-compose.dev.yml restart backend
```

---

## AUTO mode details
AUTO is designed to be beginner-proof:
- If Postgres is reachable **and** inbox migrations exist → uses DB
- Otherwise → falls back to memory (seeded demo)

Helper:
```bash
bash scripts/dev/inbox_store_auto.sh
# optional
bash scripts/dev/inbox_store_auto.sh --seed-db
```

---

## Dev auth + visibility (why you might see `restricted: true`)
In dev, the backend accepts viewer identity via:
- header `x-sd-viewer`
- cookie `sd_viewer`

If no viewer is provided, the backend is **default-safe** and returns `restricted: true` with no content.

See the deterministic dev visibility policy in `docs/INBOX_VISIBILITY_STUB.md`.

---

## Debug endpoints (dev-only)
The Inbox debug panel uses:
- `POST /api/inbox/debug/unread/reset`
- `POST /api/inbox/debug/incoming`

They work in all store modes (`memory`, `db`, `auto`).

---

## Troubleshooting

### I set `SD_INBOX_STORE=db` and the inbox breaks
Most common causes:
1) Docker Desktop is not running.
2) migrations were not applied.

Fix:
```bash
bash scripts/dev/inbox_db_seed.sh --switch
```

### AUTO keeps falling back to memory
AUTO only uses DB when Postgres is reachable and migrations exist.

Fix:
```bash
bash scripts/dev/inbox_store_auto.sh --seed-db
```

### Everything is `restricted: true`
You didn’t provide a dev viewer identity.

Fix (browser): set cookie:
- `sd_viewer=me`

Or send header:
- `x-sd-viewer: me`

### Next.js hydration error in the Inbox UI
If the stack trace includes `chrome-extension://.../inpage.js`, it’s almost always a browser extension injecting DOM.

Fix:
- open the app in Incognito (extensions off)
- or disable the extension for `localhost`
