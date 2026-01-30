# Phase 2.13 — Rituals (Pulse)

This Spider Pack maps Siddes **Rituals** end-to-end:

**SideFeed → RitualDock → (Create/View/Reply) Sheets → Next API proxies → Django Rituals app → DB models**

Scope: **structural + data-contract mapping** (no fix suggestions).

---

## 0) Topology (one-screen mental model)

### 0.1 Dock read path (what powers “Pulse” above the feed)
1. `SideFeed` renders `<RitualDock side={side} activeSet={activeSet} ... />`
2. `RitualDock` calls `provider.dock({ side, setId })`
3. Provider fetches same-origin `GET /api/rituals?side=<side>&setId=<setId>`
4. Next route handler proxies to backend `GET /api/rituals?...`
5. Backend returns `{ restricted, items[] }` where each item is a `RitualItem`

### 0.2 Write paths
- **Create**: `RitualCreateSheet` → `provider.create()` → `POST /api/rituals` → `{ ok, ritual }`
- **Ignite**: `POST /api/rituals/<id>/ignite` → `{ ok, ritual }`
- **Respond**: `RitualSheet` → `provider.respond()` → `POST /api/rituals/<id>/respond` → `{ ok, ritual }`
- **Read responses**: `RitualSheet` → `provider.responses()` → `GET /api/rituals/<id>/responses` → `{ ok, ritualId, items[] }`

---

## 1) User-facing surfaces (Frontend)

### 1.1 RitualDock (Pulse above feed)
- **Purpose:** displays up to a few active/warming rituals for the current Side; acts as entrypoint to view/reply/create.
- **File:** `frontend/src/components/RitualDock.tsx`
- **State dependencies:** `useState`, `useEffect`, `useMemo`
- **Chameleon:** uses `SIDE_THEMES[ritual.side]` and `SIDES[ritual.side]`
- **External tissue:** `lucide-react` icons; `toast` (`frontend/src/lib/toast`)

Key interactions:
- `provider.dock({ side, setId: activeSet })` on Side/Circle change
- Opens:
  - `RitualCreateSheet` (Start)
  - `RitualSheet` (View/Reply)

### 1.2 RitualCreateSheet (Start ritual)
- **Purpose:** creates a ritual (v1: set-scoped for non-public).
- **File:** `frontend/src/components/RitualCreateSheet.tsx`
- **State dependencies:** `useState`, `useEffect`, `useMemo`
- **Chameleon:** `SIDE_THEMES[side]`, `SIDES[side]`
- **External tissue:** `lucide-react`, `toast`

Create call:
- `provider.create({ side, setId, kind, title, prompt, expiresAt? })`

### 1.3 RitualSheet (View ritual + respond)
- **Purpose:** fetches ritual detail + responses; submits a response (text or structured payload).
- **File:** `frontend/src/components/RitualSheet.tsx`
- **State dependencies:** `useState`, `useEffect`, `useMemo`
- **Chameleon:** derives `side` from ritual and uses `SIDE_THEMES[side]`
- **External tissue:** `lucide-react`, `toast`

Read calls:
- `provider.get(ritualId)`
- `provider.responses(ritualId)`

Write call:
- `provider.respond(ritualId, { payload?, text? })`

### 1.4 Where RitualDock is mounted
- **Purpose:** Rituals are a *feed-adjacent* system, mounted above the feed list.
- **File:** `frontend/src/components/SideFeed.tsx`
- **Call site:** `<RitualDock ... />`

---

## 2) Frontend service + types (Contracts)

### 2.1 Types
- **File:** `frontend/src/lib/ritualsTypes.ts`

**RitualItem (frontend type mirror):**
```ts
export type RitualItem = {
  id: string;
  kind: string;
  title: string;
  prompt: string;
  status: string; // proposed|warming|active|archived|...
  side: "public"|"friends"|"close"|"work";
  setId: string | null;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
  igniteThreshold: number;
  ignites: number;
  replies: number;
  data: Record<string, any>; // dock summary hints (avatars/topAnswers/vibe/progress)
};
```

**RitualResponseItem (frontend type mirror):**
```ts
export type RitualResponseItem = {
  id: string;
  by: string;
  byDisplay?: { id?: string; handle?: string; name?: string };
  createdAt: number;
  kind: string;
  payload: Record<string, any>;
  text: string;
};
```

### 2.2 Provider interface
- **File:** `frontend/src/lib/ritualsProvider.ts`
- **Provider:** `getRitualsProvider()` returns `backendStubProvider`

### 2.3 Same-origin provider implementation
- **File:** `frontend/src/lib/ritualsProviders/backendStub.ts`
- **Endpoints hit (same-origin):**
  - `GET  /api/rituals?side=&setId=`
  - `POST /api/rituals`
  - `GET  /api/rituals/:id`
  - `POST /api/rituals/:id/ignite`
  - `POST /api/rituals/:id/respond`
  - `GET  /api/rituals/:id/responses`

- **Restricted handling:** uses `RestrictedError` and `isRestrictedPayload` from `frontend/src/lib/restricted`

---

## 3) Next.js server layer (Rituals API proxies)

All Ritual endpoints are implemented as **Next Route Handlers** that proxy to Django via `proxyJson()`.

### 3.1 Route handlers (Next)
- `GET/POST /api/rituals`
  - **File:** `frontend/src/app/api/rituals/route.ts`
- `GET /api/rituals/:id`
  - **File:** `frontend/src/app/api/rituals/[id]/route.ts`
- `POST /api/rituals/:id/ignite`
  - **File:** `frontend/src/app/api/rituals/[id]/ignite/route.ts`
- `POST /api/rituals/:id/respond`
  - **File:** `frontend/src/app/api/rituals/[id]/respond/route.ts`
- `GET /api/rituals/:id/responses`
  - **File:** `frontend/src/app/api/rituals/[id]/responses/route.ts`

### 3.2 Proxy + dev viewer injection
- Proxy helper: `frontend/src/app/api/auth/_proxy.ts` (`proxyJson`)
- Dev-only viewer: `resolveStubViewer` (`frontend/src/lib/server/stubViewer`) injects `x-sd-viewer` when `NODE_ENV != production`

---

## 4) Backend (Django/DRF)

### 4.1 App + wiring
- App: `backend/siddes_rituals/`
- Included under `/api/` root by: `backend/siddes_backend/api.py` (includes `siddes_rituals.urls`)

### 4.2 URLConf
- **File:** `backend/siddes_rituals/urls.py`

Backend endpoints (canonical):
- `GET  /api/rituals?side=<public|friends|close|work>&setId=<optional>` → `RitualsView.get`
- `POST /api/rituals` → `RitualsView.post`
- `GET  /api/rituals/<id>` → `RitualDetailView.get`
- `POST /api/rituals/<id>/ignite` → `RitualIgniteView.post`
- `POST /api/rituals/<id>/respond` → `RitualRespondView.post`
- `GET  /api/rituals/<id>/responses` → `RitualResponsesView.get`

### 4.3 Models
- **File:** `backend/siddes_rituals/models.py`

DB entities:
- `Ritual`
  - `id` (string PK)
  - `side` (`public|friends|close|work`)
  - `set_id` (nullable; required for non-public in v1)
  - `kind`, `title`, `prompt`
  - `status` (`proposed|warming|active|archived`)
  - `created_by`, `created_at`, `expires_at`
  - `ignite_threshold`, `ignites`
  - `replies`
  - `data` (JSON summary for dock: progress/avatars/topAnswers/vibe/host)

- `RitualIgnite` (one per `(ritual, viewer)`)
- `RitualResponse` (one per `(ritual, viewer)`, upsert semantics)

### 4.4 View helpers that define the contract
- `_ritual_to_item(r)` returns the server JSON shape consumed by the frontend.
- `_viewer_ctx(request)` defines viewer identity (session in prod; debug header/cookie only when `DEBUG=True`).
- `_load_ritual_or_none(viewer_id, ritual_id)` centralizes read access rules.

Key file:
- **File:** `backend/siddes_rituals/views.py`

---

## 5) Data contracts (Request/Response)

### 5.1 List dock rituals
**Request:**
- `GET /api/rituals?side=<side>&setId=<optional>`

**Response (success):**
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_1",
  "role": "me",
  "side": "friends",
  "setId": "set_123",
  "items": [<RitualItem>, ...]
}
```

**Response (unknown viewer):**
```json
{
  "ok": true,
  "restricted": true,
  "viewer": null,
  "role": "anon",
  "side": "friends",
  "setId": "set_123",
  "items": []
}
```

### 5.2 Create ritual
**Request:** `POST /api/rituals`
```json
{
  "side": "friends",
  "setId": "set_123",
  "kind": "mood",
  "title": "Vibe Check",
  "prompt": "Mood check — how are you today?",
  "expiresAt": 1730000000.0
}
```

**Response:**
```json
{ "ok": true, "ritual": <RitualItem> }
```

### 5.3 Get ritual detail
**Request:** `GET /api/rituals/<id>`

**Response:**
```json
{ "ok": true, "ritual": <RitualItem> }
```

**Not readable / no existence leaks:**
```json
{ "ok": false, "error": "not_found" }
```

### 5.4 Ignite ritual
**Request:** `POST /api/rituals/<id>/ignite` (empty JSON body)

**Response:**
```json
{ "ok": true, "ritual": <RitualItem> }
```

### 5.5 Respond to ritual
**Request:** `POST /api/rituals/<id>/respond`
```json
{
  "payload": { "emoji": "😄", "note": "Good day" },
  "text": ""
}
```

or text answer:
```json
{ "payload": {}, "text": "Shipping is blocked by approvals." }
```

**Response:**
```json
{ "ok": true, "ritual": <RitualItem> }
```

### 5.6 List responses
**Request:** `GET /api/rituals/<id>/responses`

**Response:**
```json
{
  "ok": true,
  "ritualId": "rt_...",
  "items": [<RitualResponseItem>, ...]
}
```

---

## 6) Guardrails (privacy + safety) — structural locations

### 6.1 Viewer identity truth
- Backend: `_raw_viewer_from_request()` in `backend/siddes_rituals/views.py`
  - Production: session-auth user → `me_<id>`
  - DEBUG: allows `x-sd-viewer` header / `sd_viewer` cookie fallback
- Next dev injection: `withDevViewer()` wrappers in Next route handlers under `frontend/src/app/api/rituals/**`

### 6.2 Launch-safe scoping
- Non-public rituals are **set-scoped** (v1) — enforced in `RitualsView.post` and `RitualsView.get`.
- “Circle.side is the truth”: backend may override requested `side` based on stored Circle side (uses `DbSetsStore().get`).

### 6.3 Existence leak avoidance
- List: unknown viewer returns `{ restricted:true, items:[] }`.
- Detail/responses/ignite/respond: unreadable rituals return `404 not_found`.
- Central function: `_load_ritual_or_none(viewer_id, ritual_id)`.

### 6.4 Blocks (best-effort)
- Backend checks blocked pairs via `siddes_safety.policy.is_blocked_pair` (wrapped; fail-open if unavailable).

### 6.5 Lifecycle controls
- Status + expiry gating exists in `backend/siddes_rituals/views.py`:
  - `_ritual_is_open(r)`
  - Expired/archived rituals are treated as not-found for interaction endpoints.

### 6.6 Throttling
- DRF throttle scopes for rituals are defined in `backend/siddes_backend/settings.py`:
  - `ritual_list`, `ritual_detail`, `ritual_responses`, `ritual_create`, `ritual_ignite`, `ritual_respond`, `ritual_public_answer`
- Public Town Hall answers use a tighter throttle scope in `RitualRespondView.get_throttles()`.

---

## 7) Third-party tissue (where external dependencies hook in)

Frontend:
- `lucide-react` icons: `RitualDock.tsx`, `RitualSheet.tsx`, `RitualCreateSheet.tsx`

Backend:
- Django + DRF (`APIView`, `Response`, `status`)

---

## 8) Quick navigation index (all relevant files)

### Frontend
- UI:
  - `frontend/src/components/RitualDock.tsx`
  - `frontend/src/components/RitualSheet.tsx`
  - `frontend/src/components/RitualCreateSheet.tsx`
  - `frontend/src/components/SideFeed.tsx` (mounts RitualDock)
- Provider/contracts:
  - `frontend/src/lib/ritualsTypes.ts`
  - `frontend/src/lib/ritualsProvider.ts`
  - `frontend/src/lib/ritualsProviders/backendStub.ts`
  - `frontend/src/lib/restricted.ts`
- Next API proxies:
  - `frontend/src/app/api/rituals/route.ts`
  - `frontend/src/app/api/rituals/[id]/route.ts`
  - `frontend/src/app/api/rituals/[id]/ignite/route.ts`
  - `frontend/src/app/api/rituals/[id]/respond/route.ts`
  - `frontend/src/app/api/rituals/[id]/responses/route.ts`
  - `frontend/src/app/api/auth/_proxy.ts` (shared proxy)
  - `frontend/src/lib/server/stubViewer.ts` (dev viewer)

### Backend
- `backend/siddes_rituals/models.py`
- `backend/siddes_rituals/urls.py`
- `backend/siddes_rituals/views.py`
- `backend/siddes_backend/api.py` (router include)
- `backend/siddes_backend/settings.py` (throttle scopes)

### Existing project docs (related)
- `docs/RITUALS.md`
- `docs/THROTTLING.md`
