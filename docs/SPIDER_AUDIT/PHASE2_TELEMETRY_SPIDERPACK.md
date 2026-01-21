# Phase 2.16 - Telemetry (Privacy-Safe Counts Only)

This Spider Pack maps Siddes' telemetry subsystem end-to-end, as implemented in this repo.

Scope: structural wiring + data contracts + guardrails (no logic critique, no fixes).

Telemetry in Siddes is explicitly privacy-safe: it records counts-only events with no PII (no handles, no contact identifiers, no names, no post text).

---

## 0) Topology (one-screen mental model)

A) Emitters (client)
- UI actions call `sdTelemetry(event, count)`.
- That does `POST /api/telemetry` (same-origin Next route).

B) Next.js proxy layer
- `frontend/src/app/api/telemetry/route.ts` proxies:
  - POST -> Django `/api/telemetry/ingest`
  - GET  -> Django `/api/telemetry/summary?days=N`

C) Storage (backend)
- Django model `TelemetryEvent(viewer_id, event, created_at)` stores one row per count.

D) Summary (backend)
- `/api/telemetry/summary?days=N` counts events for the requesting viewer id within a time window.

E) Dev dashboard
- `/developer/telemetry` (dev-only) visualizes counts and rates via `GET /api/telemetry?days=N`.

---

## 1) Frontend surfaces and emitters

### 1.1 Telemetry event union + sender

- File: `frontend/src/lib/telemetry/sdTelemetry.ts`

Events supported client-side:
- `suggestion_shown`
- `suggestion_accepted`
- `suggestion_skipped`
- `suggestion_edited`
- `suggestion_undo`
- `embeddings_opt_in` (declared; not currently emitted)
- `embeddings_opt_out` (declared; not currently emitted)

Sender function:
- `sdTelemetry(event, count=1)`
- POSTs JSON: `{ event, count }` to `/api/telemetry`
- Wrapped in try/catch; failures are ignored.

Privacy note is enforced by convention here:
- Comment explicitly forbids sending handles/contact identifiers/raw names.

### 1.2 Call sites (exact emitters)

`sdTelemetry()` is called only from these UI surfaces:

1) Suggested Sets review sheet
- File: `frontend/src/components/SuggestedSetsSheet.tsx`
- Emits:
  - `suggestion_shown` (count = number of suggestions shown) when sheet opens
  - `suggestion_accepted` (count = 1 or N) on accept
  - `suggestion_skipped` (count = 1 or N) on skip
  - `suggestion_edited` (count = 1) when removing a member or renaming

2) Suggested Sets tray (feed/onboarding helper)
- File: `frontend/src/components/SuggestedSetsTray.tsx`
- Emits:
  - `suggestion_accepted` (count = 1 or N)
  - `suggestion_skipped` (count = 1 or N)
  - `suggestion_undo` (count = number of suggestions restored)

3) Onboarding page (undo path)
- File: `frontend/src/app/onboarding/page.tsx`
- Emits:
  - `suggestion_undo` (count = number of suggestions restored)

Count semantics:
- Most events are emitted with a count meaning "how many suggestions were affected".
- Backend clamps counts to a max of 50 per request.

### 1.3 Developer telemetry dashboard (dev only)

- Route: `frontend/src/app/developer/telemetry/page.tsx`
  - In production builds it calls `notFound()` to hide the page.

- Client: `frontend/src/app/developer/telemetry/telemetryClient.tsx`
  - Fetches `GET /api/auth/me` to detect auth state.
  - Fetches `GET /api/telemetry?days=7|30` and displays:
    - raw counts
    - derived rates (accept/skip/edit/undo)

---

## 2) Next.js API layer (proxy)

- File: `frontend/src/app/api/telemetry/route.ts`

Endpoints:
- `POST /api/telemetry`
  - Reads JSON body (defaults to `{}` on parse failure)
  - Proxies to Django: `POST /api/telemetry/ingest`

- `GET /api/telemetry?days=N`
  - Proxies to Django: `GET /api/telemetry/summary?days=N`

Proxy primitive:
- Uses `proxyJson()` from `frontend/src/app/api/auth/_proxy.ts`.
  - Responsible for cookie forwarding + request-id propagation.

---

## 3) Backend telemetry subsystem (Django/DRF)

### 3.1 Mount point

- File: `backend/siddes_backend/api.py`
- Mounts telemetry router at:
  - `/api/telemetry/*` -> `include("siddes_telemetry.urls")`

### 3.2 URLConf

- File: `backend/siddes_telemetry/urls.py`

Routes:
- `POST /api/telemetry/ingest` -> `TelemetryIngestView`
- `GET  /api/telemetry/summary` -> `TelemetrySummaryView`

### 3.3 Views and enforcement

- File: `backend/siddes_telemetry/views.py`

Key structures:
- `ALLOWED_EVENTS`: allowlist matches the frontend union.
- `SIDDES_TELEMETRY_ENABLED` knob: if disabled, endpoints return 404 with `telemetry_disabled`.

Authentication:
- `permission_classes = [IsAuthenticated]` for both ingest and summary.
- In DEBUG, dev viewer auth can satisfy this via DRF auth:
  - File: `backend/siddes_backend/drf_auth.py` (`DevHeaderViewerAuthentication`)
  - Header: `x-sd-viewer` or cookie `sd_viewer`
  - Important: dev viewer never applies to `/api/auth/*` but DOES apply to `/api/telemetry/*`.

Viewer id source:
- `_viewer_id(request)` returns a string id for:
  - production session user: `str(request.user.id)` (typically numeric)
  - DEBUG dev viewer: `request.user` is `SiddesViewer(id="...")`, so id can be `"me_1"`, `"me"`, etc.

Ingest clamping:
- `count` coerced to int
- clamped to `1..50`

Summary window:
- query param `days` coerced to int
- clamped to `1..30`

### 3.4 Storage model

- File: `backend/siddes_telemetry/models.py`

`TelemetryEvent` fields:
- `viewer_id: CharField(max_length=64)`
- `event: CharField(max_length=80)`
- `created_at: DateTimeField(auto_now_add=True)`

Index:
- `(viewer_id, event, created_at)`

Migrations:
- `0001_initial.py` created a FK to user
- `0002_...` migrated to `viewer_id` string (privacy + portability)

### 3.5 Retention and ops

Settings knobs:
- File: `backend/siddes_backend/settings.py`
  - `SIDDES_TELEMETRY_ENABLED` (default true via env)
  - `SIDDES_TELEMETRY_RETENTION_DAYS` (default 30)

Purge command:
- File: `backend/siddes_telemetry/management/commands/purge_telemetry.py`
- Usage:
  - `python manage.py purge_telemetry --dry-run`
  - `python manage.py purge_telemetry --days 30`

---

## 4) Data contracts (request/response)

### 4.1 Ingest

Frontend:
- `POST /api/telemetry`

Backend:
- `POST /api/telemetry/ingest`

Request body:
```json
{ "event": "suggestion_accepted", "count": 3 }
```

Constraints:
- `event` must be in `ALLOWED_EVENTS`
- `count` is clamped to `1..50`

Success response:
```json
{ "ok": true }
```

Error responses:
- 404: `{ "ok": false, "error": "telemetry_disabled" }`
- 401: `{ "ok": false, "error": "no_viewer" }`
- 400: `{ "ok": false, "error": "invalid_event" }`

### 4.2 Summary

Frontend:
- `GET /api/telemetry?days=7`

Backend:
- `GET /api/telemetry/summary?days=7`

Success response:
```json
{
  "ok": true,
  "days": 7,
  "counts": {
    "suggestion_shown": 12,
    "suggestion_accepted": 7,
    "suggestion_skipped": 5,
    "suggestion_edited": 3,
    "suggestion_undo": 1
  }
}
```

Error responses:
- 404: `{ "ok": false, "error": "telemetry_disabled" }`
- 401: `{ "ok": false, "error": "no_viewer" }`

---

## 5) Guardrails summary (structural)

1) Privacy-safe by design
- Client only sends `{event,count}`; server only stores `{viewer_id,event,created_at}`.

2) Auth required
- DRF `IsAuthenticated` gate on ingest + summary.
- DEBUG dev viewer auth can satisfy auth via `x-sd-viewer` / `sd_viewer`.

3) Global kill switch
- `SIDDES_TELEMETRY_ENABLED=0` disables telemetry endpoints (returns 404).

4) Dev-only visualization
- `/developer/telemetry` is hidden in production via `notFound()`.

---

## 6) Third-party tissue

Frontend:
- Standard `fetch()` + Next route handlers (no analytics SDK)

Backend:
- Django ORM + DRF `APIView`

Transitive:
- `@opentelemetry/api` appears in `frontend/package-lock.json` (transitive), but there is no direct telemetry SDK usage in Siddes code.

---

## 7) File index (complete for telemetry)

Frontend
- `frontend/src/lib/telemetry/sdTelemetry.ts`
- `frontend/src/app/api/telemetry/route.ts`
- `frontend/src/app/developer/telemetry/page.tsx`
- `frontend/src/app/developer/telemetry/telemetryClient.tsx`
- `frontend/src/components/SuggestedSetsSheet.tsx`
- `frontend/src/components/SuggestedSetsTray.tsx`
- `frontend/src/app/onboarding/page.tsx`

Backend
- `backend/siddes_backend/settings.py` (knobs)
- `backend/siddes_backend/api.py` (mount)
- `backend/siddes_backend/drf_auth.py` (dev viewer auth)
- `backend/siddes_telemetry/models.py`
- `backend/siddes_telemetry/views.py`
- `backend/siddes_telemetry/urls.py`
- `backend/siddes_telemetry/migrations/0001_initial.py`
- `backend/siddes_telemetry/migrations/0002_remove_telemetryevent_...py`
- `backend/siddes_telemetry/management/commands/purge_telemetry.py`

Docs (existing internal reference)
- `docs/ML_PART_8_PRIVACY_SAFE_TELEMETRY.md`
