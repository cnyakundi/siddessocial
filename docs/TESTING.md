# Siddes — Testing & Quality Gates
**Updated:** 2026-01-10

This project uses a **test ladder**. Not every overlay runs every rung, but every overlay must pass a minimum gate.

---

## 1) The Test Ladder
### L0 — Preflight
- Repo overlay sanity: docs present, scripts executable  
Command:
```bash
./verify_overlays.sh
```

### L1 — Static checks (fast)
Frontend:
- lint
- typecheck

Backend:
- import/compile checks
- Django `check`

### L2 — Unit tests
- frontend unit tests (when added)
- backend unit tests (Django/pytest)

### L3 — Integration tests
- API ↔ DB checks (test DB)
- Side visibility enforcement tests

### L4 — E2E (Playwright)
- switch side
- create post
- open signals sheet
- echo sheet
- set filtering

### L5 — PWA / performance
- manifest validity
- SW registration + update strategy
- offline fallback
- Lighthouse budgets

---

## 2) Minimum gate (required for every overlay)

Tip: you can run a faster smoke rung:
```bash
bash scripts/run_tests.sh --smoke
```

Full harness (default):
```bash
bash scripts/run_tests.sh
```
Every overlay must pass:
```bash
./verify_overlays.sh
./scripts/run_tests.sh
```

`run_tests.sh` is best-effort:
- it runs frontend/back-end checks if your repo has them configured
- it warns (does not hard-fail) if a script doesn't exist yet

Over time we tighten this into a strict gate once the repo has lint/typecheck/test scripts wired.

---


## 3) How to run tests
### Host mode (if you have local environments)
```bash
./scripts/run_tests.sh
```

### DRF quick smokes (seconds)
Use these when working on backend/visibility.
```bash
bash scripts/dev/drf_smoke.sh
bash scripts/dev/inbox_visibility_smoke.sh
```

### Docker mode (optional)
If you use `ops/docker/docker-compose.dev.yml`:
```bash
docker compose -f ops/docker/docker-compose.dev.yml up -d --build
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py test
docker compose -f ops/docker/docker-compose.dev.yml exec frontend npm test
```
---

## 4) Overlay-specific tests
Any overlay that touches:
- side enforcement
- contact hashing
- PWA caching / push

…must add a short overlay test section in its README that proves correctness.
