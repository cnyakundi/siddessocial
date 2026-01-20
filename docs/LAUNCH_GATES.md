# LAUNCH GATES

“Military-grade” launch checklist.

---

## Observability baseline (sd_158)

Backend:
- `X-Request-ID` on every `/api/*` response
- JSON-line logs for `/api/*` requests (request_id, viewer, method, path, status, latency_ms)

Frontend:
- `error.tsx` boundaries for core routes (calm retry, no blank screens)

---

## Deployment gates (sd_159)

See: `docs/DEPLOYMENT_GATES.md` for P0/P1/P2 launch blockers and evidence commands.
