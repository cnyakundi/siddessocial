# Phase 2.6 — Inbox Spider Pack (Siddes)

**Scope:** Inbox end-to-end mapping across **UI → Provider → Next API → Django/DRF → Store → Models**, including **thread locking to a Side**, **restricted responses**, **unread/pins local state**, and **dev-only debug tools**.

**Mode:** Structural + data-contract mapping only (no fixes, no refactors).

---

## 0) Inbox “DNA” (core invariants)

Inbox in Siddes is a **threaded conversation system** with two primary UI surfaces:
- **Thread list:** `/siddes-inbox`
- **Thread detail:** `/siddes-inbox/:id`

Non‑negotiable invariants enforced by both UI and API layers:
1) **Locked Side is the truth.** Every thread is locked to exactly one Side (`lockedSide`).
2) **Default-safe restriction.** If the server cannot confidently authorize the viewer, it returns `restricted: true` **with no content**.
3) **Same-origin access.** The browser talks to Next `/api/*`; Next proxies to Django; session cookies are the truth in production.
4) **Local device state exists** for UX (pins/unread/thread cache), but server is the truth for visibility and thread existence.

Canonical contract doc:
- `docs/INBOX_BACKEND_CONTRACT.md`

---

## 1) System entry points (UI → Provider → API)

### 1.1 Frontend routes (Next App Router)

**Thread list + Alerts tab**
- `/siddes-inbox` — thread list (with optional `?tab=alerts` and optional `?side=<SideId>` for API filter)
  - **Path:** `frontend/src/app/siddes-inbox/page.tsx`
  - **Notable inline atoms inside this page:** `AvatarBubble`, `SidePill`, `ContextRiskBadge`, `FilterChipsRow` (page-local)

**Thread detail**
- `/siddes-inbox/[id]` — thread viewer + composer
  - **Path:** `frontend/src/app/siddes-inbox/[id]/page.tsx`
  - **Notable inline atoms inside this page:** `AvatarBubble`, `ContextRiskStrip`, `SidePickerSheet`, `WarningBar`, `MoveConfirmBar` (some are defined but not currently rendered)

**Error boundaries**
- `frontend/src/app/siddes-inbox/error.tsx`
- `frontend/src/app/siddes-inbox/[id]/error.tsx`

### 1.2 Reusable UI components involved
- `InboxBanner` — standardized banner surface for errors/restricted states
  - **Path:** `frontend/src/components/InboxBanner.tsx`
- `NotificationsView` — used as the “Alerts” tab embed inside Inbox
  - **Path:** `frontend/src/components/NotificationsView.tsx`
- `MentionPicker` — thread composer mention UI (currently rendered with empty items)
  - **Path:** `frontend/src/components/MentionPicker.tsx`

### 1.3 Frontend provider + local stores

**Provider interface**
- **Path:** `frontend/src/lib/inboxProvider.ts`
- Provider name currently fixed to: `backend_stub`

**Provider implementation (real network)**
- **Path:** `frontend/src/lib/inboxProviders/backendStub.ts`
- Hits same-origin endpoints:
  - `GET /api/inbox/threads`
  - `GET /api/inbox/thread/:id`
  - `POST /api/inbox/thread/:id` (send message OR change lockedSide)
- Includes a 30s sessionStorage cache for thread views:
  - **Path:** `frontend/src/lib/inboxCache.ts`

**Local persistence used by Inbox UI**
- Thread messages + meta (localStorage): `frontend/src/lib/threadStore.ts`
- Unread hints (localStorage): `frontend/src/lib/inboxState.ts`
- Pinned threads (localStorage): `frontend/src/lib/inboxPins.ts`
- Recent move targets (localStorage): `frontend/src/lib/inboxMoveRecents.ts`

### 1.4 Next API route handlers (proxy surface)

These are the same-origin endpoints the browser actually calls.

- `GET /api/inbox/threads` → proxies to Django `GET /api/inbox/threads`
  - **Path:** `frontend/src/app/api/inbox/threads/route.ts`
- `GET /api/inbox/thread/:id` → proxies to Django `GET /api/inbox/thread/:id`
  - **Path:** `frontend/src/app/api/inbox/thread/[id]/route.ts`
- `POST /api/inbox/thread/:id` → proxies to Django `POST /api/inbox/thread/:id`
  - **Path:** `frontend/src/app/api/inbox/thread/[id]/route.ts`

Dev-only Next debug route (separate from Django debug):
- `POST /api/inbox/debug/incoming` — only when `NODE_ENV !== production`
  - **Path:** `frontend/src/app/api/inbox/debug/incoming/route.ts`

All proxy routes rely on:
- `proxyJson()` — cookie forwarding, request-id forwarding, etc.
  - **Path:** `frontend/src/app/api/auth/_proxy.ts`

### 1.5 Backend endpoints (Django/DRF)

Backend API mount:
- `backend/siddes_backend/api.py` includes: `path("inbox/", include("siddes_inbox.urls"))`

DRF URLConf:
- **Path:** `backend/siddes_inbox/urls.py`

Endpoints:
- `GET /api/inbox/threads` — list threads
- `GET /api/inbox/thread/<thread_id>` — read thread + messages
- `POST /api/inbox/thread/<thread_id>` — send message OR move thread (`setLockedSide`)

Dev-only endpoints (require `DJANGO_DEBUG=1` + viewer == `me`):
- `POST /api/inbox/debug/unread/reset`
- `POST /api/inbox/debug/incoming`

DRF handlers:
- **Path:** `backend/siddes_inbox/views.py`

---

## 2) Data contracts (the shapes that travel over the wire)

Canonical contract definition:
- `docs/INBOX_BACKEND_CONTRACT.md`

### 2.1 `SideId`
One of:
- `public`
- `friends`
- `close`
- `work`

Frontend source:
- `frontend/src/lib/sides.ts` (`SideId` type)

Backend source:
- `backend/siddes_inbox/models.py` (`SideId` TextChoices)
- `backend/siddes_inbox/models_stub.py` (`SideId` Literal)

### 2.2 `Participant` (thread identity)
The contract expects a participant snapshot (UI renders initials + optional displayName).

```json
{
  "displayName": "Marcus",
  "initials": "MM",
  "avatarSeed": "seed_4a9f0c2b",
  "userId": "u_123", 
  "handle": "@marcus"
}
```

Backend stub shape source:
- `backend/siddes_inbox/models_stub.py` → `ParticipantRecord`

### 2.3 `ThreadItem` (thread list row)

Contract shape:
```json
{
  "id": "t_work_1",
  "title": "Work Circle",
  "participant": { "displayName": "Work Circle", "initials": "WG", "avatarSeed": "seed_..." },
  "lockedSide": "work",
  "last": "Updated the roadmap slides…",
  "time": "10m",
  "unread": 2,
  "updatedAt": 1704872330123
}
```

Notes (what the UI uses today):
- Frontend type `InboxThread` is currently minimal (no `participant`, no `updatedAt`):
  - `frontend/src/lib/inboxTypes.ts`
- Inbox list UI reads `participant` and `updatedAt` via `(t as any)` where available:
  - `frontend/src/app/siddes-inbox/page.tsx`

### 2.4 `ThreadMeta` (lockedSide + updatedAt)
```json
{
  "lockedSide": "friends",
  "updatedAt": 1704872330123
}
```

Frontend mirror:
- `frontend/src/lib/threadStore.ts` → `ThreadMeta`

Backend builders:
- `backend/siddes_inbox/endpoint_stub.py` → `_meta()`
- `backend/siddes_inbox/store_db.py` creates `ThreadMetaRecord`

### 2.5 `ThreadMessage`
```json
{
  "id": "m_k3j9...",
  "ts": 1704872330123,
  "from": "me",
  "text": "Hey — are we still on for Saturday?",
  "side": "friends",
  "queued": false,
  "clientKey": "optional_idempotency_key"
}
```

Frontend mirror:
- `frontend/src/lib/threadStore.ts` (`ThreadMessage`) uses `from: "me" | "them"` and optional `queued`/`side`.

Backend builders:
- `backend/siddes_inbox/endpoint_stub.py` → `_message()`
- `backend/siddes_inbox/views.py` → `_message_dict()` (debug responses)

---

## 3) Endpoint map (Provider → Next → Django)

Provider interface:
- `frontend/src/lib/inboxProvider.ts`

### 3.1 `listThreads(opts)`
**HTTP:** `GET /api/inbox/threads`

Query params:
- `side` (optional): `SideId`
- `limit` (optional): default 20 (UI uses 20), backend clamps 1..50
- `cursor` (optional): opaque

Response (success):
```json
{
  "ok": true,
  "restricted": false,
  "items": [/* ThreadItem[] */],
  "hasMore": true,
  "nextCursor": "1704872330123:t_work_1"
}
```

Response (restricted):
```json
{ "ok": true, "restricted": true, "items": [], "hasMore": false, "nextCursor": null }
```

Where it’s implemented:
- Next proxy: `frontend/src/app/api/inbox/threads/route.ts`
- Django DRF: `backend/siddes_inbox/views.py` → `InboxThreadsView.get()`
- Store contract: `backend/siddes_inbox/store.py` → `list_threads()`

### 3.2 `getThread(id, opts)`
**HTTP:** `GET /api/inbox/thread/:id`

Query params:
- `limit` (optional): default 30, max 100 in contract (backend clamps 1..100 in view; DB store clamps to 50 internally)
- `cursor` (optional): opaque

Response (success):
```json
{
  "ok": true,
  "restricted": false,
  "thread": { /* ThreadItem */ },
  "meta": { /* ThreadMeta */ },
  "messages": [/* ThreadMessage[] */],
  "messagesHasMore": true,
  "messagesNextCursor": "1704872000000:m_abc123"
}
```

Response (restricted):
```json
{
  "ok": true,
  "restricted": true,
  "thread": null,
  "meta": null,
  "messages": [],
  "messagesHasMore": false,
  "messagesNextCursor": null
}
```

Where it’s implemented:
- Next proxy: `frontend/src/app/api/inbox/thread/[id]/route.ts`
- Django DRF: `backend/siddes_inbox/views.py` → `InboxThreadView.get()`
- Store contract: `backend/siddes_inbox/store.py` → `get_thread()`

### 3.3 `sendMessage(id, text, from, opts)`
**HTTP:** `POST /api/inbox/thread/:id`

Body:
```json
{ "text": "hello", "clientKey": "optional" }
```

Response (success):
```json
{ "ok": true, "restricted": false, "message": { /* ThreadMessage */ }, "meta": { /* ThreadMeta */ } }
```

Restricted:
```json
{ "ok": true, "restricted": true, "message": null, "meta": null }
```

Error (missing text): HTTP 400
```json
{ "ok": false, "error": "missing_text" }
```

Where it’s implemented:
- Next proxy: `frontend/src/app/api/inbox/thread/[id]/route.ts` (POST)
- Django DRF: `backend/siddes_inbox/views.py` → `InboxThreadView.post()` (text branch)
- Store contract: `backend/siddes_inbox/store.py` → `send_message()`

### 3.4 `setLockedSide(id, side, opts)`
**HTTP:** `POST /api/inbox/thread/:id`

Body:
```json
{ "setLockedSide": "work" }
```

Response (success):
```json
{ "ok": true, "restricted": false, "meta": { "lockedSide": "work", "updatedAt": 1704872330123 } }
```

Where it’s implemented:
- Next proxy: `frontend/src/app/api/inbox/thread/[id]/route.ts` (POST)
- Django DRF: `backend/siddes_inbox/views.py` → `InboxThreadView.post()` (setLockedSide branch)
- Store contract: `backend/siddes_inbox/store.py` → `set_locked_side()`

### 3.5 Dev-only debug endpoints (backend)
Enabled only when `DJANGO_DEBUG` is truthy and viewer is `me`.
- `POST /api/inbox/debug/unread/reset` (body: `{ threadId }`)
- `POST /api/inbox/debug/incoming` (body: `{ threadId, text }`)

Implementation:
- `backend/siddes_inbox/views.py` → `InboxDebugResetUnreadView`, `InboxDebugIncomingView`

---

## 4) Interaction map (how the user moves through Inbox)

### 4.1 Thread list → thread detail
**Thread list page** (`frontend/src/app/siddes-inbox/page.tsx`)
- Fetches the thread list:
  - `provider.listThreads({ side: apiSide, limit: 20 })`
- Renders each thread row as a `Link` to `/siddes-inbox/<id>`.

**Side mismatch guardrail at navigation time** (structural):
- Each row computes `mismatch = (lockedSide !== activeSide)`.
- If mismatch:
  - it prevents default navigation,
  - calls `setSide(lockedSide)`,
  - then `router.push(/siddes-inbox/<id>)`.

### 4.2 List rendering uses local thread cache for last message
In the thread list, the row’s displayed `lastText` prefers:
1) The last local message in `threadStore` (`loadThread(id)`)
2) The server-provided `ThreadItem.last`

If the thread is mismatched (lockedSide != activeSide), the UI intentionally hides the last message preview.

### 4.3 Thread detail read path
**Thread detail page** (`frontend/src/app/siddes-inbox/[id]/page.tsx`)
- Loads:
  - `provider.getThread(id, { limit: 30 })`
- Writes results to local:
  - `saveThread(id, messages)`
  - `saveThreadMeta(id, meta)`
- Clears local unread:
  - `clearThreadUnread(id)`

### 4.4 Messages pagination (“Load earlier”)
- Thread detail uses `messagesHasMore` + `messagesNextCursor` from the server.
- When loading earlier:
  - `provider.getThread(id, { limit: 30, cursor: messagesNextCursor })`

### 4.5 Offline behavior (local-only)
If `navigator.onLine === false`, thread detail:
- appends a local message with `queued: true` using `appendMessage()`
- persists via `threadStore` localStorage

---

## 5) State dependencies (the “brains” of Inbox UI)

### 5.1 `/siddes-inbox` (thread list) state deps
**Path:** `frontend/src/app/siddes-inbox/page.tsx`

Hooks and dependencies:
- `useSide()` → active Side + `setSide`
- `useRouter()` and `useSearchParams()` → navigation + URL filters (`tab`, `side`)
- `useMemo()` → provider instance, derived rows
- `useEffect()` → initial fetch, refresh on focus, keyboard navigation, time ticker
- Local stores:
  - `threadStore` (`ensureThreadLockedSide`, `loadThread`, `loadThreadMeta`)
  - `inboxState` (`loadUnreadMap`)
  - `inboxPins` (`loadPinnedSet`, `togglePinned`)

### 5.2 `/siddes-inbox/:id` (thread detail) state deps
**Path:** `frontend/src/app/siddes-inbox/[id]/page.tsx`

Hooks and dependencies:
- `useParams()` → thread id
- `useSide()` → active Side (used for label + local fallback locking)
- `useMemo()` → provider
- `useEffect()` → load thread on mount
- Local stores:
  - `threadStore` (`saveThread`, `saveThreadMeta`, `ensureThreadLockedSide`, `appendMessage`, `setThreadLockedSide`)
  - `inboxState` (`clearThreadUnread`)
  - `inboxMoveRecents` (`loadRecentMoveSides`, `pushRecentMoveSide`)

---

## 6) Backend store architecture (internal “organs”)

### 6.1 DRF views call “endpoint stubs”
DRF does not serialize Django models directly; instead it uses a contract-shaped module:
- **Endpoint contract mapping:** `backend/siddes_inbox/endpoint_stub.py`

DRF views:
- `InboxThreadsView` → calls `endpoint_stub.list_threads(store, viewer_id, side, limit, cursor)`
- `InboxThreadView` → calls `endpoint_stub.get_thread(...)` / `send_message(...)` / `set_locked_side(...)`

### 6.2 Store interface (InboxStore)
- **Path:** `backend/siddes_inbox/store.py`
- Methods:
  - `list_threads()`
  - `get_thread()`
  - `send_message()`
  - `set_locked_side()`

### 6.3 Store implementations present in repo
- **In-memory store:** `backend/siddes_inbox/store_memory.py` (`InMemoryInboxStore`)
- **DB store:** `backend/siddes_inbox/store_db.py` (`DbInboxStore`)
- **Dual-write helper:** `backend/siddes_inbox/store_dualwrite.py` (`DualWriteInboxStore`)
- **Dev-null:** `backend/siddes_inbox/store_devnull.py` (`DevNullInboxStore`)

### 6.4 Store selection (what the DRF views actually instantiate)
- **Path:** `backend/siddes_inbox/views.py`
- Viewer identity resolution:
  - uses authenticated Django user (session) first
  - uses dev header/cookie only when `settings.DEBUG=True`
- Store selection in the current code:
  - memory store is only enabled when `DEBUG=True` and `SIDDES_ALLOW_MEMORY_STORES=1`
  - otherwise defaults to `DbInboxStore()`

Related docs that describe historical/desired env toggles (may drift from this selection):
- `docs/INBOX_DB.md` (mentions `SD_INBOX_STORE=memory|db|auto`)

### 6.5 DB models (“Inbox at rest”)
- **Path:** `backend/siddes_inbox/models.py`

Core tables:
- `InboxThread` — includes locked_side, participant snapshot, last_text cache, owner_viewer_id
- `InboxMessage` — message rows with `side` and optional `client_key`
- `InboxThreadReadState` — per-viewer read marker (`last_read_ts`) for unread derivation

---

## 7) Guardrails & enforcement points (structural locations)

### 7.1 Frontend guardrails
- **Mismatch hiding** (list view): hides message preview + forces Side switch before open
  - `frontend/src/app/siddes-inbox/page.tsx`
- **Private-side warnings** (list view): `ContextRiskBadge` when thread locked to private side
  - `frontend/src/app/siddes-inbox/page.tsx`
- **Private-side warning strip** (thread detail): `ContextRiskStrip`
  - `frontend/src/app/siddes-inbox/[id]/page.tsx`

### 7.2 Backend guardrails
- **Default-safe restriction** when viewer cannot be resolved
  - `backend/siddes_inbox/endpoint_stub.py` (`_restricted_*` payloads)
  - `backend/siddes_inbox/views.py` (`get_viewer_id` + views always return `restricted` shapes)
- **Block enforcement** (hard stop: no DM/read)
  - `backend/siddes_inbox/views.py` uses `siddes_safety.policy.is_blocked_pair`
    - filters blocked threads in list (`_filter_blocked_threads_payload`)
    - restricts blocked thread reads (`_restrict_blocked_thread_payload`)
    - blocks send/move if blocked (`InboxThreadView.post`)
- **Dev-only debug** gated by env + viewer
  - `backend/siddes_inbox/views.py` (`_debug_enabled()` + viewer == `me`)

---

## 8) Third-party tissue (where external libs hook in)

### 8.1 Frontend
- **Next.js App Router** (`useRouter`, `useSearchParams`, `useParams`, `Link`) — navigation + URL state
  - `frontend/src/app/siddes-inbox/page.tsx`
  - `frontend/src/app/siddes-inbox/[id]/page.tsx`
- **React Suspense** wrapper for search params hydration
  - `frontend/src/app/siddes-inbox/page.tsx`
- **lucide-react** icons (Lock, Pin, Search, Send, AlertTriangle, etc.)
  - both inbox pages

### 8.2 Backend
- **Django REST Framework** (`APIView`, `Response`, status codes, throttle_scope)
  - `backend/siddes_inbox/views.py`
- **Django ORM** (DbInboxStore)
  - `backend/siddes_inbox/store_db.py`

---

## 9) File inventory (Inbox subsystem)

### Frontend
- `frontend/src/app/siddes-inbox/page.tsx` — Inbox list + Alerts tab embed
- `frontend/src/app/siddes-inbox/[id]/page.tsx` — Thread detail + send message
- `frontend/src/app/api/inbox/threads/route.ts` — Next proxy: list threads
- `frontend/src/app/api/inbox/thread/[id]/route.ts` — Next proxy: thread read + send/move
- `frontend/src/app/api/inbox/debug/incoming/route.ts` — Next dev-only debug simulate incoming
- `frontend/src/components/InboxBanner.tsx` — banner UI
- `frontend/src/lib/inboxProvider.ts` — provider interface
- `frontend/src/lib/inboxProviders/backendStub.ts` — provider implementation hitting /api/inbox/*
- `frontend/src/lib/inboxTypes.ts` — minimal InboxThread type used by UI
- `frontend/src/lib/threadStore.ts` — local thread messages + meta store
- `frontend/src/lib/inboxState.ts` — local unread store
- `frontend/src/lib/inboxPins.ts` — local pins store
- `frontend/src/lib/inboxMoveRecents.ts` — local move recents store
- `frontend/src/lib/inboxCache.ts` — 30s sessionStorage cache for thread view

### Backend
- `backend/siddes_inbox/urls.py` — DRF URLConf
- `backend/siddes_inbox/views.py` — DRF endpoints + viewer resolution + block enforcement
- `backend/siddes_inbox/endpoint_stub.py` — contract-shaped JSON assembly
- `backend/siddes_inbox/store.py` — InboxStore interface
- `backend/siddes_inbox/store_memory.py` — InMemoryInboxStore (seeded demos)
- `backend/siddes_inbox/store_db.py` — DbInboxStore (ORM)
- `backend/siddes_inbox/store_dualwrite.py` — dual-write helper
- `backend/siddes_inbox/store_devnull.py` — dev-null placeholder
- `backend/siddes_inbox/models.py` — InboxThread / InboxMessage / InboxThreadReadState
- `backend/siddes_inbox/models_stub.py` — contract dataclasses
- `backend/siddes_backend/api.py` — mounts inbox router at `/api/inbox/`

### Docs (Inbox)
- `docs/INBOX_BACKEND_CONTRACT.md` — canonical contract
- `docs/INBOX_DB.md` — store modes doc (env toggles)
- `docs/INBOX_PAGINATION.md` — cursor semantics
- `docs/INBOX_VISIBILITY_STUB.md` — deterministic dev viewer roles

