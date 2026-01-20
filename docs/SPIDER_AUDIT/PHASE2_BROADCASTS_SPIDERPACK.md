# Phase 2 Spider Pack — Broadcasts (Public Desks)

This pack is the **structural map** of Siddes **Broadcasts** (Public-only desks/channels) across:

- **Frontend UI surfaces** (Public feed “Broadcasts” mode, Broadcasts index, Broadcast hub, Broadcast compose, onboarding)
- **Next.js API proxy layer** (`/api/broadcasts/*`)
- **Django/DRF endpoints + DB store** (`/api/broadcasts*` + `siddes_broadcasts` tables)
- **Cross-module integration** with the **Posts** pipeline (broadcast updates are Posts with a `b_*` set_id)

---

## 0) Source-of-truth files

### Frontend (UI)
Primary routes:
- `frontend/src/app/siddes-broadcasts/page.tsx` — **Broadcasts index** (tabs: Following / Discover, search, follow/unfollow).
- `frontend/src/app/siddes-broadcasts/create/page.tsx` — **Create broadcast** (POST `/api/broadcasts`).
- `frontend/src/app/siddes-broadcasts/[id]/page.tsx` — **Broadcast hub** (posts list + about/team + follow + notify + writers management).
- `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx` — **Broadcast update composer** (Public-only, writers-only, draft persistence, offline queue).

Embedded / cross-surface entry points:
- `frontend/src/components/SideFeed.tsx` — Public feed has `publicMode: "following" | "broadcasts"` and **fetches `/api/broadcasts/feed`** when in broadcasts mode.
- `frontend/src/components/PublicTuneSheet.tsx` — exposes “Feed: Following vs Broadcasts” toggle.
- `frontend/src/components/DesktopButlerTray.tsx` — shows **Broadcast updates** via `GET /api/broadcasts/unread` (quiet dots).
- `frontend/src/app/onboarding/page.tsx` — onboarding step loads Discover broadcasts and lets user follow/unfollow.

Other navigation references:
- `frontend/src/components/BottomNav.tsx` — highlights Broadcasts route under Public.
- `frontend/src/components/DesktopTopBar.tsx` — title mapping for `/siddes-broadcasts/*`.
- `frontend/src/app/siddes-profile/account/page.tsx` — link to `/siddes-broadcasts`.

### Frontend (Next API proxy layer)
Handlers under `frontend/src/app/api/broadcasts/**`:
- `frontend/src/app/api/broadcasts/route.ts`
  - `GET /api/broadcasts?tab=&q=&category=` → backend `GET /api/broadcasts`
  - `POST /api/broadcasts` → backend `POST /api/broadcasts`
- `frontend/src/app/api/broadcasts/feed/route.ts` — `GET /api/broadcasts/feed` → backend `GET /api/broadcasts/feed`
- `frontend/src/app/api/broadcasts/unread/route.ts` — `GET /api/broadcasts/unread` → backend `GET /api/broadcasts/unread`
- `frontend/src/app/api/broadcasts/[id]/route.ts` — `GET /api/broadcasts/:id` → backend `GET /api/broadcasts/:id`
- `frontend/src/app/api/broadcasts/[id]/posts/route.ts` — `GET /api/broadcasts/:id/posts` → backend `GET /api/broadcasts/:id/posts`
- `frontend/src/app/api/broadcasts/[id]/follow/route.ts` — `POST /api/broadcasts/:id/follow` → backend `POST /api/broadcasts/:id/follow`
- `frontend/src/app/api/broadcasts/[id]/unfollow/route.ts` — `POST /api/broadcasts/:id/unfollow` → backend `POST /api/broadcasts/:id/unfollow`
- `frontend/src/app/api/broadcasts/[id]/notify/route.ts` — `POST /api/broadcasts/:id/notify` → backend `POST /api/broadcasts/:id/notify`
- `frontend/src/app/api/broadcasts/[id]/seen/route.ts` — `POST /api/broadcasts/:id/seen` → backend `POST /api/broadcasts/:id/seen`
- `frontend/src/app/api/broadcasts/[id]/writers/route.ts` — `GET/POST/DELETE /api/broadcasts/:id/writers` → backend `GET/POST/DELETE /api/broadcasts/:id/writers`

Shared proxy + CSRF plumbing that these routes rely on:
- `frontend/src/app/api/auth/_proxy.ts` — `proxyJson()` (cookie forwarding, request-id forwarding, origin/referer forwarding)
- `frontend/src/lib/csrf.ts` + `frontend/src/components/AuthBootstrap.tsx` — patches fetch for `x-csrftoken` on unsafe `/api/*` writes.

### Backend (DRF + DB)
- `backend/siddes_broadcasts/models.py` — DB models: `Broadcast`, `BroadcastMember`.
- `backend/siddes_broadcasts/store_db.py` — canonical JSON shapes produced for UI:
  - `broadcast_to_item()`
  - `list()`, `create()`, `get()`, `follow()`, `unfollow()`, `set_notify()`
  - `list_posts()`, `feed()`, `list_unread()`, `list_writers()`, `add_writer()`, `remove_writer()`
- `backend/siddes_broadcasts/views.py` — DRF endpoints (viewer ctx + restricted payload conventions).
- `backend/siddes_broadcasts/urls.py` — URL map under `/api/`.
- `backend/siddes_backend/api.py` — includes `siddes_broadcasts.urls` under `/api/`.

Cross-module integration points:
- `backend/siddes_post/views.py` — **broadcast gating for post creation** when `set_id` starts with `b_` and **touches broadcast last_post_at** after creation.

---

## 1) UI entrypoints + interaction map

### A) Public feed → Broadcasts mode
1) User is in Public (`useSide()` = `public`).
2) User toggles **Tune → Feed → Broadcasts** (PublicTuneSheet).
   - Source: `frontend/src/components/PublicTuneSheet.tsx`
3) `SideFeed` sees `publicMode === "broadcasts"` and loads:
   - `GET /api/broadcasts/feed` → items shown via `PostCard`
   - Source: `frontend/src/components/SideFeed.tsx`

### B) Explore Broadcasts index
- Entry link exists in Public empty state:
  - `frontend/src/components/SideFeed.tsx` → `/siddes-broadcasts`
- Broadcasts index:
  - Route: `/siddes-broadcasts`
  - File: `frontend/src/app/siddes-broadcasts/page.tsx`
  - Calls `GET /api/broadcasts?tab=following|discover&q=`
  - Follow/unfollow uses:
    - `POST /api/broadcasts/:id/follow`
    - `POST /api/broadcasts/:id/unfollow`

### C) Broadcast hub
- Route: `/siddes-broadcasts/:id`
- File: `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
- On mount (Public-only):
  - `POST /api/broadcasts/:id/seen` (best-effort)
  - `GET /api/broadcasts/:id` (metadata)
  - `GET /api/broadcasts/:id/posts` (updates)
  - `GET /api/broadcasts/:id/writers` (determines `canWrite` + team visibility)
- Actions:
  - Follow/unfollow: `POST /api/broadcasts/:id/follow|unfollow`
  - Notifications: `POST /api/broadcasts/:id/notify` (mode + muted)
  - Writers: `POST/DELETE /api/broadcasts/:id/writers`
  - Compose: link to `/siddes-broadcasts/:id/compose` if `canWrite`

### D) Broadcast compose (updates)
- Route: `/siddes-broadcasts/:id/compose`
- File: `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`
- Guardrails:
  - Forces **Public Side**: if `side !== public` → `PublicEnterConfirmSheet`.
  - Writers-only: calls `GET /api/broadcasts/:id/writers`; `res.ok` determines `canWrite`.
- Posting:
  - Online: `POST /api/post` with `{ side: "public", setId: <broadcastId>, text, client_key: "bc_<ts>" }`
  - Offline: queues via `enqueuePost("public", text, { setId: <broadcastId> })` and closes.
- Drafts:
  - Uses `localStorage` key `sd.compose.broadcast.drafts.v1`.

### E) Butler tray unread dots
- Desktop tray calls:
  - `GET /api/broadcasts/unread`
- File: `frontend/src/components/DesktopButlerTray.tsx`

### F) Onboarding “pick broadcasts”
- `frontend/src/app/onboarding/page.tsx` calls:
  - `GET /api/broadcasts?tab=discover`
  - `POST /api/broadcasts/:id/follow|unfollow`

---

## 2) Atomic building blocks (front-end)

### `SiddesBroadcastsPage` (Broadcast index)
- **File:** `frontend/src/app/siddes-broadcasts/page.tsx`
- **Purpose:** Lists broadcasts (Following/Discover), allows search + follow/unfollow.
- **State deps:** `useSide()`, `useRouter()`, `useState`, `useEffect`, `useMemo`.
- **Guardrail:** if not Public → `PublicEnterConfirmSheet`.

### `CreateBroadcastPage` (Create)
- **File:** `frontend/src/app/siddes-broadcasts/create/page.tsx`
- **Purpose:** Create broadcast metadata.
- **State deps:** `useSide()`, `useRouter()`, `useState`, `useEffect`.
- **Guardrail:** Public-only via `PublicEnterConfirmSheet`.

### `BroadcastHubPage` (Hub)
- **File:** `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
- **Purpose:** Broadcast landing page: posts, about, team (owner/writer).
- **State deps:** `useSide()`, `useRouter()`, `useState`, `useEffect`, `useMemo`.
- **Embedded atom:** `NotifySheet` defined inline (mode + mute).

### `BroadcastComposePage` (Composer)
- **File:** `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`
- **Purpose:** Post update into a broadcast (writers-only).
- **State deps:** `useSide()`, `useRouter()`, `useState`, `useEffect`, `useMemo`, `useRef`.
- **Internal deps:** `offlineQueue` (`enqueuePost`, `removeQueuedItem`), `toast`.

### Cross-surface atoms
- `PublicEnterConfirmSheet` — used to enforce the “Public doorway”.
  - `frontend/src/components/PublicEnterConfirmSheet.tsx`
- `SideFeed` public mode toggle uses `PublicTuneSheet` to expose the Broadcast feed mode.
  - `frontend/src/components/SideFeed.tsx`
  - `frontend/src/components/PublicTuneSheet.tsx`

---

## 3) API layer (Next.js proxy)

### Endpoint map (same-origin)
| Frontend | Method | Backend target | Purpose |
|---|---:|---|---|
| `/api/broadcasts` | GET | `/api/broadcasts` | list (Following/Discover) |
| `/api/broadcasts` | POST | `/api/broadcasts` | create broadcast |
| `/api/broadcasts/feed` | GET | `/api/broadcasts/feed` | posts from followed broadcasts |
| `/api/broadcasts/unread` | GET | `/api/broadcasts/unread` | unread dots list |
| `/api/broadcasts/:id` | GET | `/api/broadcasts/:id` | broadcast detail |
| `/api/broadcasts/:id/posts` | GET | `/api/broadcasts/:id/posts` | broadcast updates |
| `/api/broadcasts/:id/follow` | POST | `/api/broadcasts/:id/follow` | follow |
| `/api/broadcasts/:id/unfollow` | POST | `/api/broadcasts/:id/unfollow` | unfollow |
| `/api/broadcasts/:id/notify` | POST | `/api/broadcasts/:id/notify` | notify mode + mute |
| `/api/broadcasts/:id/seen` | POST | `/api/broadcasts/:id/seen` | mark as seen |
| `/api/broadcasts/:id/writers` | GET/POST/DELETE | `/api/broadcasts/:id/writers` | team list + manage |

All handlers use `proxyJson()` in `frontend/src/app/api/auth/_proxy.ts` (cookie + csrftoken forward).

---

## 4) Backend endpoints + storage

### URL map
**File:** `backend/siddes_broadcasts/urls.py`
- `GET/POST /api/broadcasts`
- `GET /api/broadcasts/feed`
- `GET /api/broadcasts/unread`
- `GET /api/broadcasts/<id>`
- `POST /api/broadcasts/<id>/follow`
- `POST /api/broadcasts/<id>/unfollow`
- `POST /api/broadcasts/<id>/notify`
- `POST /api/broadcasts/<id>/seen`
- `GET/POST/DELETE /api/broadcasts/<id>/writers`
- `GET /api/broadcasts/<id>/posts`

### DB models
**File:** `backend/siddes_broadcasts/models.py`

`Broadcast`:
- `id` (PK, string, typically `b_<ms>_<rand>`)
- `owner_id` (viewer token: `me_<django_user_id>`)
- `name`, `handle` (unique), `category`, `desc`, `pinned_rules`
- `subscriber_count` (int)
- `last_post_at` (float seconds; drives unread dots + ordering)
- timestamps

`BroadcastMember`:
- `broadcast` FK
- `viewer_id` (token)
- `role` (`owner|writer|subscriber`)
- `notify_mode` (`off|highlights|all`)
- `muted` (bool)
- `last_seen_at` (float seconds)
- timestamps

### Store contract
**File:** `backend/siddes_broadcasts/store_db.py`
- The UI-facing JSON shapes come from:
  - `broadcast_to_item(b, viewer_id)`
  - `list_posts()` and `feed()` (post items)
  - `list_unread()` (broadcast items + `lastUpdateAt`)
  - `list_writers()` (team items)

---

## 5) Data contracts

### 5.1 BroadcastItem (canonical shape)
Produced by `broadcast_to_item()` in `backend/siddes_broadcasts/store_db.py`.

```ts
type BroadcastRole = "owner" | "writer" | "subscriber";
type NotifyMode = "off" | "highlights" | "all";

type BroadcastItem = {
  id: string;              // e.g. "b_1730000000000_ab12cd34"
  name: string;
  handle: string;          // normalized lowercase, always starts with '@'
  category: string;
  desc: string;

  subscribers: number;
  isFollowing: boolean;

  viewerRole: BroadcastRole | null;
  notifyMode: NotifyMode;  // defaults to "off" for non-members
  muted: boolean;

  hasUnread: boolean;
  lastPostAt: number | null; // epoch ms
  lastUpdate: string;        // "now" | "5m" | "2h" | "3d" | ""
};
```

### 5.2 Broadcast post item (updates)
Produced by `list_posts()` and `feed()` in `backend/siddes_broadcasts/store_db.py`.

```ts
type BroadcastPost = {
  id: string; // Post id
  author: string;
  handle: string;
  time: string; // currently "now" (UI-friendly placeholder)
  content: string;
  kind: "text";
  setId: string; // broadcast id (b_*)
  broadcast: { id: string; name: string; handle: string } | null;
  createdAt: number; // epoch ms
};
```

### 5.3 Writers list item
Produced by `list_writers()` in `backend/siddes_broadcasts/store_db.py`.

```ts
type WriterItem = { viewerId: string; role: "owner" | "writer" };
```

### 5.4 Response envelopes (backend)

**GET `/api/broadcasts`**
- If not authenticated: returns **HTTP 200** with `{ ok:true, restricted:true, items: [] }`.
- If authenticated: `{ ok:true, restricted:false, tab, count, items:[BroadcastItem] }`.

**POST `/api/broadcasts`**
- Requires authenticated `role == "me"`.
- Success (201): `{ ok:true, item: BroadcastItem }`.
- Errors:
  - 400 `{ ok:false, error:"bad_handle" }`
  - 409 `{ ok:false, error:"handle_taken" }`

**GET `/api/broadcasts/:id`**
- Not authed: HTTP 200 restricted payload with `item:null`.
- Not found: 404 `{ ok:false, error:"not_found" }`
- Success: `{ ok:true, item: BroadcastItem }`

**POST `/api/broadcasts/:id/follow|unfollow`**
- Requires viewer; returns `{ ok:true, item: BroadcastItem }`.

**POST `/api/broadcasts/:id/notify`**
- Request body: `{ mode: "off"|"highlights"|"all", muted: boolean }`
- Response: `{ ok:true, item: BroadcastItem }`

**POST `/api/broadcasts/:id/seen`**
- Response: `{ ok:true, broadcastId: string }`

**GET `/api/broadcasts/:id/posts`**
- Response: `{ ok:true, broadcastId, count, items: BroadcastPost[] }`

**GET `/api/broadcasts/feed`**
- Response: `{ ok:true, count, items: BroadcastPost[] }`

**GET `/api/broadcasts/unread`**
- Response: `{ ok:true, hasUnread, count, items: (BroadcastItem & { lastUpdateAt?: number })[] }`

**GET/POST/DELETE `/api/broadcasts/:id/writers`**
- GET requires owner/writer membership, else 403 `{ ok:false, error:"forbidden" }`.
- POST/DELETE require owner, else 403 `{ ok:false, error:"owner_required" }`.

---

## 6) Guardrails + privacy rules (structural locations)

### Public-only doorway
All broadcast pages enforce Public via:
- `useSide()` + `PublicEnterConfirmSheet` in:
  - `frontend/src/app/siddes-broadcasts/page.tsx`
  - `frontend/src/app/siddes-broadcasts/create/page.tsx`
  - `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
  - `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`

### Writers-only posting
Broadcast updates are created through the **Posts** endpoint, but are **gated** when `set_id` is a broadcast id (`b_*`).
- Enforcement point: `backend/siddes_post/views.py` (`PostCreateView`)
  - If `set_id.startswith("b_")` then `siddes_broadcasts.store_db.STORE.can_write(viewer_id, broadcast_id)` must be true.
  - Fail-closed on exception: returns 503 `broadcast_unavailable`.

### Unread dots (calm)
Unread state is computed by comparing:
- `Broadcast.last_post_at` vs `BroadcastMember.last_seen_at`
- Computation: `backend/siddes_broadcasts/store_db.py` (`broadcast_to_item`, `list_unread`, `mark_seen`)

### Team privacy
Team list is visible only to owner/writer.
- Gate: `BroadcastWritersView.get` checks membership role.
- File: `backend/siddes_broadcasts/views.py`

---

## 7) Third-party tissue (exact hooks)

Frontend:
- **Next.js App Router** pages + route handlers
  - `frontend/src/app/siddes-broadcasts/**`
  - `frontend/src/app/api/broadcasts/**`
- **lucide-react** icons
  - Broadcasts list: `Radio`, `Search`, `RefreshCcw`, `Bell`
  - Hub: `Bell`, `Users`, `Shield`, `PenSquare`, etc.
  - Compose: `Globe`, `Loader2`, etc.
- **@tanstack/react-virtual** indirectly (SideFeed list virtualization); broadcast feed uses same rendering pipeline.

Backend:
- **Django + DRF** (`APIView`, `Response`, status codes)
- **Django ORM** (`Broadcast`, `BroadcastMember`, `Post`)

---

## 8) Cross-module note (broadcasts are Posts)

Broadcast updates are stored in the **Post** table as:
- `side = "public"`
- `set_id = <broadcastId>` where broadcast ids **start with `b_`**

That is the core “DNA” connection between:
- `siddes_broadcasts` (metadata + membership + unread)
and
- `siddes_post` (content + post ids + post detail)


