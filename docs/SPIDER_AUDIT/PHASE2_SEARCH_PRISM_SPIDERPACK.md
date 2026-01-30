# Phase 2.10 — Search + Prism (Discovery + Identity Facets)

This pack maps Siddes' **discovery surfaces** (Search) and **identity surfaces** (Prism Profile), end-to-end across:

- **UI routes** → **Next API proxies** → **Django endpoints** → **DB models**

> Scope: **structural + contract mapping** only (no fix suggestions).

---

## 1) User-facing surfaces (frontend)

### 1.1 Search results page (currently: Circles-only search)
- Route: `/search`
- Purpose: client-side search across **Circles** (label + member handles) for all Sides.
- Files:
  - `frontend/src/app/search/page.tsx` (Suspense wrapper)
  - `frontend/src/app/search/client.tsx` (search UI + fetch)

**Data source (today):** `/api/circles?side=<side>` (4 calls, one per Side), then filter on the client.

### 1.2 Search entry points
- AppTopBar search button opens the search overlay.
- DesktopTopBar also opens the same overlay.
- Overlay behavior: on Enter → navigates to `/search?q=<query>&tab=posts` (tab is currently informational).
- Files:
  - `frontend/src/components/AppTopBar.tsx`
  - `frontend/src/components/DesktopTopBar.tsx`
  - `frontend/src/components/DesktopSearchOverlay.tsx`

### 1.3 Prism Profile (owner view)
- Route: `/siddes-profile`
- Purpose: owner previews/edits 4 identity facets (Public/Friends/Close/Work).
- Data sources:
  - `/api/auth/me` (auth state)
  - `/api/prism` (GET facets; PATCH facet updates)
- Files:
  - `frontend/src/app/siddes-profile/page.tsx`
  - `frontend/src/components/PrismProfile.tsx`

### 1.4 Prism Profile (viewer view)
- Route: `/u/[username]`
- Purpose: viewer sees **one** facet selected by relationship; viewer can "side" the user.
- Data sources:
  - `/api/profile/<handle>` (viewer-resolved facet)
  - `/api/side` (POST relationship edge)
- Files:
  - `frontend/src/app/u/[username]/page.tsx`
  - `frontend/src/components/PrismProfile.tsx`

---

## 2) Next.js API layer (route handlers)

### 2.1 Prism proxies
- `GET /api/prism` → backend `GET /api/prism`
- `PATCH /api/prism` → backend `PATCH /api/prism`
- File: `frontend/src/app/api/prism/route.ts`

### 2.2 Viewer-resolved profile + side action proxies
- `GET /api/profile/[username]` → backend `GET /api/profile/<username>`
  - File: `frontend/src/app/api/profile/[username]/route.ts`
- `POST /api/side` → backend `POST /api/side`
  - File: `frontend/src/app/api/side/route.ts`

### 2.3 Search proxies (backend search endpoints)
> These proxies exist even though `/search` UI currently searches Circles via `/api/circles`.

- `GET /api/search/users?q=&limit=` → backend `GET /api/search/users?q=&limit=`
  - File: `frontend/src/app/api/search/users/route.ts`
- `GET /api/search/posts?q=&limit=` → backend `GET /api/search/posts?q=&limit=`
  - File: `frontend/src/app/api/search/posts/route.ts`

### 2.4 User lookup proxies (backend search user endpoints)
- `GET /api/users/[username]` → backend `GET /api/users/<username>`
  - File: `frontend/src/app/api/users/[username]/route.ts`
- `GET /api/users/[username]/posts?limit=` → backend `GET /api/users/<username>/posts?limit=`
  - File: `frontend/src/app/api/users/[username]/posts/route.ts`

---

## 3) Django endpoints (backend)

### 3.1 siddes_prism (identity facets + side graph)
Mounted under `/api/` via `backend/siddes_backend/api.py`.

- `GET /api/prism` (owner facets)
- `PATCH /api/prism` (owner facet update)
- `GET /api/profile/<username>` (viewer-resolved facet)
- `POST /api/side` (create/update/delete relationship edge)

Files:
- `backend/siddes_prism/urls.py`
- `backend/siddes_prism/views.py`
- `backend/siddes_prism/models.py`

### 3.2 siddes_search (discovery endpoints)
Mounted under `/api/` via `backend/siddes_backend/api.py`.

- `GET /api/search/users?q=&limit=`
- `GET /api/search/posts?q=&limit=` (public posts only)
- `GET /api/users/<username>`
- `GET /api/users/<username>/posts?limit=` (public posts only)

Files:
- `backend/siddes_search/urls.py`
- `backend/siddes_search/views.py`

---

## 4) Persistence (backend models)

### 4.1 PrismFacet (one per user per Side)
- Model: `PrismFacet`
- Uniqueness: `(user, side)` unique constraint
- File: `backend/siddes_prism/models.py`

Fields (DB):
- `user` (FK)
- `side` (public|friends|close|work)
- `display_name`, `headline`, `bio`
- `location`, `website`, `cover_image_url`
- `anthem_title`, `anthem_artist`
- `pulse_label`, `pulse_text`
- `created_at`, `updated_at`

### 4.2 SideMembership (relationship edge)
- Model: `SideMembership`
- Meaning: owner has placed member into a Side
- Constraints:
  - unique `(owner, member)`
  - no `public` (public is absence of an edge)
  - no `owner == member`
- File: `backend/siddes_prism/models.py`

---

## 5) Data contracts (request/response shapes)

### 5.1 Prism facet shape (shared)
Produced by backend `_facet_dict()`.

```json
{
  "side": "public|friends|close|work",
  "displayName": "string",
  "headline": "string",
  "bio": "string",
  "location": "string|null",
  "website": "string|null",
  "coverImage": "string|null",
  "anthem": {"title": "string", "artist": "string"} | null,
  "pulse": {"label": "string", "text": "string"} | null,
  "updatedAt": "ISO-8601 string|null"
}
```

Backend file: `backend/siddes_prism/views.py`

Frontend type mirror:
- `PrismFacet` in `frontend/src/components/PrismProfile.tsx`

### 5.2 Owner Prism facets
**GET** `/api/prism`

```json
{
  "ok": true,
  "user": {"id": 1, "username": "alice", "handle": "@alice"},
  "items": [<PrismFacet>]
}
```

**PATCH** `/api/prism` request

```json
{
  "side": "public|friends|close|work",
  "displayName": "string",
  "headline": "string",
  "bio": "string",
  "location": "string",
  "website": "string",
  "coverImage": "string",
  "anthem": {"title": "string", "artist": "string"},
  "pulse": {"label": "string", "text": "string"}
}
```

**PATCH** `/api/prism` response

```json
{"ok": true, "item": <PrismFacet>}
```

Frontend call site:
- `frontend/src/app/siddes-profile/page.tsx`

### 5.3 Viewer-resolved profile
**GET** `/api/profile/<username>`

```json
{
  "ok": true,
  "user": {"id": 2, "username": "bob", "handle": "@bob"},
  "viewSide": "public|friends|close|work",
  "facet": <PrismFacet>,
  "siders": 123 | "Close Vault" | null,
  "viewerSidedAs": "friends|close|work" | null,
  "sharedSets": ["string", "string"]
}
```

Notes (structural):
- `viewSide` is computed from **target -> viewer** SideMembership edge.
- `viewerSidedAs` is computed from **viewer -> target** SideMembership edge.

Frontend call site:
- `frontend/src/app/u/[username]/page.tsx`

### 5.4 Side action (viewer classification)
**POST** `/api/side`

Request:
```json
{"username": "@alice", "side": "friends|close|work|public"}
```

Response:
```json
{"ok": true, "side": "friends|close|work" | null}
```

Backend file: `backend/siddes_prism/views.py` (`SideActionView`)

### 5.5 Search users
**GET** `/api/search/users?q=<q>&limit=<n>`

Response:
```json
{
  "ok": true,
  "restricted": false,
  "q": "string",
  "count": 2,
  "items": [
    {"id": 1, "username": "alice", "handle": "@alice", "isStaff": false}
  ]
}
```

Restricted (no viewer resolved):
```json
{"ok": true, "restricted": true, "viewer": null, "role": "anon", "count": 0, "items": []}
```

Backend file: `backend/siddes_search/views.py` (`SearchUsersView`)

### 5.6 Search posts (public only)
**GET** `/api/search/posts?q=<q>&limit=<n>`

Response:
```json
{
  "ok": true,
  "restricted": false,
  "q": "string",
  "count": 10,
  "items": [<FeedPost-like objects>],
  "serverTs": 1730000000.12
}
```

Notes (structural):
- Search results are limited to `side="public"` posts.
- Items are hydrated to match the PostCard feed contract when possible.

Backend file: `backend/siddes_search/views.py` (`SearchPostsView`)

### 5.7 User lookup + public posts
- `GET /api/users/<username>` returns a minimal user object
- `GET /api/users/<username>/posts?limit=` returns public posts in FeedPost-like shape

Backend file: `backend/siddes_search/views.py`

---

## 6) Interaction maps (how a user moves through this subsystem)

### 6.1 Search flow (UI)
1) User taps Search button in top chrome
   - `AppTopBar` or `DesktopTopBar`
2) `DesktopSearchOverlay` opens
3) Enter key navigates to:
   - `/search?q=<query>&tab=posts`
4) `/search` client fetches sets for each side:
   - `/api/circles?side=friends|close|work|public`
5) Results render grouped by Side theme tokens
6) Each result offers an "Open" link:
   - `/siddes-circles?side=<sid>`

### 6.2 Prism owner flow
1) User visits `/siddes-profile`
2) Page fetches:
   - `/api/auth/me`
   - `/api/prism` (facets)
3) User previews facets using `OwnerTopRow`
4) User edits using `PrismFacetEditSheet`:
   - PATCH `/api/prism`
5) Share link points to viewer route:
   - `/u/<username>`

### 6.3 Prism viewer flow
1) Viewer visits `/u/<username>`
2) Page fetches viewer-resolved facet:
   - GET `/api/profile/<handle>`
3) Viewer can "Side" the person via sheet:
   - POST `/api/side` with `{ username: @target, side }`
4) UI updates `viewerSidedAs` locally to reflect current edge

---

## 7) Guardrails (structural enforcement points)

### 7.1 Viewer identity resolution (prod-safe)
- `siddes_prism`: `_user_from_request()`
  - Priority: session user
  - DEBUG-only: maps dev viewer tokens back to Django User
- `siddes_search`: `_raw_viewer_from_request()`
  - Priority: session user → `me_<id>`
  - DEBUG-only: header/cookie fallback

Files:
- `backend/siddes_prism/views.py`
- `backend/siddes_search/views.py`

### 7.2 Restricted payload pattern (search)
- If viewer is missing, backend returns `ok:true, restricted:true` with empty items (HTTP 200).
- This is a **contract-level** guardrail that prevents accidental data exposure.

File:
- `backend/siddes_search/views.py`

### 7.3 Relationship constraints (side graph)
- No self-siding
- No `public` membership edge (public is the absence of an edge)

File:
- `backend/siddes_prism/models.py`

---

## 8) Third-party tissue (where dependencies enter)

### 8.1 Frontend
- Next.js App Router:
  - `next/link`, `next/navigation` used in `/search`, `/siddes-profile`, `/u/[username]`, and search overlay
- lucide-react icons:
  - Search icon in overlays and search page
  - Prism icons (Globe/Users/Lock/Briefcase, etc.)

Key files:
- `frontend/src/components/DesktopSearchOverlay.tsx`
- `frontend/src/components/PrismProfile.tsx`
- `frontend/src/app/search/client.tsx`

### 8.2 Backend
- Django REST Framework: `APIView`, `Response`, `status`
- Django ORM: `get_user_model`, model queries

Key files:
- `backend/siddes_prism/views.py`
- `backend/siddes_search/views.py`

---

## 9) Complete call-site inventory (this subsystem)

### 9.1 Files that render or route to `/search`
- `frontend/src/components/DesktopSearchOverlay.tsx` (router.push to `/search?...`)
- `frontend/src/app/search/page.tsx`
- `frontend/src/app/search/client.tsx`

### 9.2 Files that call `/api/prism`
- `frontend/src/app/siddes-profile/page.tsx` (GET + PATCH)
- `frontend/src/app/api/prism/route.ts` (proxy)

### 9.3 Files that call `/api/profile/*` or `/api/side`
- `frontend/src/app/u/[username]/page.tsx` (GET profile + POST side)
- `frontend/src/app/api/profile/[username]/route.ts` (proxy)
- `frontend/src/app/api/side/route.ts` (proxy)

### 9.4 Backend endpoints for this subsystem
- Prism:
  - `backend/siddes_prism/urls.py`
  - `backend/siddes_prism/views.py`
  - `backend/siddes_prism/models.py`
- Search:
  - `backend/siddes_search/urls.py`
  - `backend/siddes_search/views.py`
