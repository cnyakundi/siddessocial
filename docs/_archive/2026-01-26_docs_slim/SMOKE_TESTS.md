# Smoke Tests

Run quick curl-based checks after applying overlays.

## Run
```bash
chmod +x scripts/dev/smoke_tests.sh
scripts/dev/smoke_tests.sh
```

## Environment overrides
- `SIDDES_BACKEND_URL` (default: http://localhost:8000)
- `SIDDES_FRONTEND_URL` (default: http://localhost:3000)
- `SIDDES_VIEWER_ID` (default: me_1)

## What it checks
- backend /healthz
- frontend /api/auth/me (proxy)
- backend /api/sets
- backend /api/telemetry/summary (optional)
- backend /api/contacts/match response shape

## Tooling notes

- On macOS, helper scripts should use `python3` (not `python`) unless you have explicitly installed a `python` shim.
- Avoid non-ASCII punctuation in scripts (e.g., em dash). It can break shells/tools and cause hard-to-debug errors.

