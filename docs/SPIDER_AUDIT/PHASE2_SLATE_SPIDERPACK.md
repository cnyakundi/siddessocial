# Phase 2.11 - Slate (Public Profile Guestbook)

This pack maps Siddes' **Public Slate** subsystem end-to-end:

**UI component -> Next.js API proxy -> Django/DRF endpoint -> DB model + seed command**

Scope: **structural + data-contract mapping only** (no fix suggestions).

---

## 1) User-facing surfaces (frontend)

### 1.1 PublicSlate (UI component)
- File: `frontend/src/components/PublicSlate.tsx`
- Props: `{ targetHandle: string, className?: string }`
- State dependencies: `useState` (items, loading), `useEffect` (fetch), `useMemo` (entries)
- Data source: `GET /api/slate?target=@handle` (client fetch uses `cache: "no-store"`)
- External UI deps: `lucide-react` (HelpCircle, MessageSquareQuote)
- Cross-feature deps: TrustLevel helpers:
  - `labelForTrustLevel()`, `normalizeTrustLevel()`, `TrustLevel` type (`frontend/src/lib/trustLevels.ts`)

### 1.2 Feature flag and docs (wiring signals)
- Build-time flag: `FLAGS.publicSlate` (`NEXT_PUBLIC_SD_PUBLIC_SLATE === "1"`)
  - File: `frontend/src/lib/flags.ts`
- Project doc: `docs/PUBLIC_SLATE.md` (spec + flag + seed instructions)
- Structural note: in this source tree, `PublicSlate` is not imported by any route/page/component other than itself (leaf component).

---

## 2) Next.js API layer (route handler)

### 2.1 /api/slate proxy
- Endpoint: `GET /api/slate?target=@handle`
- File: `frontend/src/app/api/slate/route.ts`
- Backend target: `GET /api/slate?target=@handle`
- Proxy helper: `proxyJson` (`frontend/src/app/api/auth/_proxy.ts`)
- Behavior: passes through backend JSON and forwards any `set-cookie` headers.

---

## 3) Django API layer (backend)

### 3.1 Public slate list endpoint
- Endpoint: `GET /api/slate?target=@handle` (alias: `handle=@handle`)
- URLConf: `backend/siddes_slate/urls.py`
- View: `PublicSlateListView` (`backend/siddes_slate/views.py`)
- Permissions: `permission_classes = []` (public read)
- Throttle scope: `slate_public`

### 3.2 API mounting
- `siddes_slate.urls` is included at API root:
  - `backend/siddes_backend/api.py` includes: `path("", include("siddes_slate.urls"))`

---

## 4) Data contracts

### 4.1 Request
Method: `GET`

Query parameters:
- `target`: string (required). Example: `@elena`
- `handle`: string (optional alias; used if `target` is missing)

Auth:
- none required for read.

### 4.2 Success response
HTTP 200

```json
{
  "ok": true,
  "target": "@handle",
  "count": 3,
  "items": [
    {
      "id": "...",
      "targetHandle": "@handle",
      "fromUserId": "...",
      "fromName": "...",
      "fromHandle": "@someone",
      "kind": "vouch",
      "text": "...",
      "trustLevel": 2,
      "ts": 1730000000000
    }
  ]
}
```

### 4.3 Error response
HTTP 400 (missing target/handle)

```json
{
  "ok": false,
  "error": "missing_target"
}
```

### 4.4 SlateEntryView object
Produced by `backend/siddes_slate/views.py`; consumed and normalized by `frontend/src/components/PublicSlate.tsx`.

Fields:
- `id`: string
- `targetHandle`: string
- `fromUserId`: string
- `fromName`: string
- `fromHandle`: string
- `kind`: `"vouch" | "question"`
- `text`: string
- `trustLevel`: integer (`0..3`)
- `ts`: integer (milliseconds since epoch)

Frontend normalization:
- `kind` is validated (only `"vouch"|"question"` accepted)
- `trustLevel` is normalized via `normalizeTrustLevel(raw, fallback=1)`
- `ts` is optional on the client type; accepted when numeric.

---

## 5) Storage layer (DB model + migrations)

### 5.1 SlateEntry model
- File: `backend/siddes_slate/models.py`

Key fields:
- `id` (CharField PK, max 64)
- `target_handle` (indexed)
- `from_user_id`, `from_name`, `from_handle`
- `kind` (`"vouch"|"question"`, indexed)
- `text` (TextField)
- `trust_level` (int, indexed)
- `created_at` (float seconds, indexed)

Composite index:
- `(target_handle, -trust_level, -created_at)`

### 5.2 Migrations
- `backend/siddes_slate/migrations/0001_initial.py`
- `backend/siddes_slate/migrations/0002_sync_model_drift.py`

### 5.3 Seed command (demo data)
- Command:
  - `python manage.py seed_public_slate_demo [--reset] [--target=@handle|auto]`
- File: `backend/siddes_slate/management/commands/seed_public_slate_demo.py`

Behavior:
- `auto` chooses `@<first_user_username>` if possible, else `@founder`
- IDs are deterministic with prefix: `seed_slate_<target>_eN`

---

## 6) Guardrails and policy touchpoints

### 6.1 Rate limiting
- View sets `throttle_scope = "slate_public"`
- Default rate configured in DRF settings:
  - `backend/siddes_backend/settings.py`:
    - `DEFAULT_THROTTLE_RATES["slate_public"] = SIDDES_THROTTLE_SLATE_PUBLIC` (default: `"60/min"`)

### 6.2 Output limiting and ordering
- Max returned: 50 entries
- Ordering: `order_by("-trust_level", "-created_at")`

### 6.3 Validation
- Missing target -> HTTP 400 `missing_target`
- `kind` constrained by model choices; client also validates kind.

---

## 7) Third-party tissue (where external dependencies hook in)

### 7.1 Frontend
- `lucide-react` icons:
  - `HelpCircle`, `MessageSquareQuote`
  - File: `frontend/src/components/PublicSlate.tsx`

### 7.2 Backend
- Django REST Framework:
  - `APIView`, `Response`, `status`
  - File: `backend/siddes_slate/views.py`
- Django ORM:
  - `SlateEntry.objects.filter(...).order_by(...)`

---

## 8) Diagnostics, docs, and checks

### 8.1 Feature documentation
- `docs/PUBLIC_SLATE.md` (flag + test steps + API + seed steps)

### 8.2 Check script
- `scripts/checks/public_slate_pinned_stack_check.sh`
  - Verifies the slate endpoint + proxy + docs wiring, and references additional profile wiring files as part of its verification list.

---

## 9) File inventory (Slate subsystem)

Frontend:
- `frontend/src/components/PublicSlate.tsx`
- `frontend/src/app/api/slate/route.ts`
- `frontend/src/lib/trustLevels.ts`
- `frontend/src/lib/flags.ts`

Backend:
- `backend/siddes_slate/models.py`
- `backend/siddes_slate/views.py`
- `backend/siddes_slate/urls.py`
- `backend/siddes_slate/migrations/0001_initial.py`
- `backend/siddes_slate/migrations/0002_sync_model_drift.py`
- `backend/siddes_slate/management/commands/seed_public_slate_demo.py`
- `backend/siddes_backend/api.py` (mount)

Docs / ops:
- `docs/PUBLIC_SLATE.md`
- `scripts/checks/public_slate_pinned_stack_check.sh`
