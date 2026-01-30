# Phase 2.5 — Circles Spider Pack (Siddes)

**Scope:** The complete Circles subsystem: **Circle definitions → membership → events/history → create/update/delete → UI surfaces (Circles pages, feed filter, compose audience) → coupling points (Invites, Posts, Rituals, Prism)**.

**Operating mode:** Structural + data-contract mapping only (no fixes/refactors).

---

## 0) What a Circle is in Siddes

A **Circle** is a **user-curated subgroup inside a Side** (Public/Friends/Close/Work). In this codebase, Circles are the main privacy fence for private content:

- **Circles belong to a Side** (`set.side`).
- **Circles have a membership list** (`set.members` as handles/tokens).
- **Circle-scoped content inherits Circle side** (server truth) and requires membership to read.

There are also **Circle Events** (audit/history) used to show changes such as renamed, moved side, members updated, recolored.

---

## 1) Canonical Circle DNA (types + stored models)

### 1.1 Frontend canonical types

**Circle type (`CircleDef`)**
- **Path:** `frontend/src/lib/sets.ts`
- Fields:
  - `id: string`
  - `side: SideId` (`public|friends|close|work`)
  - `label: string`
  - `color: CircleColor` (`orange|purple|blue|emerald|rose|slate`)
  - `members: string[]` (handles like `@name`, plus other viewer tokens in practice)
  - `count: number` (UI hint)

**Circle Events (`CircleEvent`)**
- **Path:** `frontend/src/lib/setEvents.ts`
- Fields:
  - `id: string`
  - `setId: string`
  - `kind: CircleEventKind` = `created|renamed|members_updated|moved_side|recolored`
  - `ts: number` (ms)
  - `by: string`
  - `data?: Record<string,any>`

**Circles Provider contract (`CirclesProvider`)**
- **Path:** `frontend/src/lib/setsProvider.ts`
- Methods:
  - `list({side?}) → CircleDef[]`
  - `get(id) → CircleDef|null`
  - `create({side?,label,members,color?}) → CircleDef`
  - `bulkCreate(inputs[]) → CircleDef[]`
  - `update(id, patch) → CircleDef|null`
  - `events(id) → CircleEvent[]`

### 1.2 Frontend theme tokens for Circles

**Circle theme tokens**
- **Path:** `frontend/src/lib/setThemes.ts`
- `CIRCLE_THEMES[color] = { bg, text, border }`
- Note: **blue is reserved for Public**; the Circle theme for `blue` renders as slate-ish classes.

### 1.3 Backend canonical storage models

**Circle model (`SiddesSet`)**
- **Path:** `backend/siddes_sets/models.py`
- Fields (DB truth):
  - `id` (string PK)
  - `owner_id` (viewer token; e.g. `me_1`)
  - `side` (`public|friends|close|work`)
  - `label`
  - `color` (`orange|purple|blue|emerald|rose|slate`)
  - `members` (JSON list)
  - `count` (int hint)
  - `created_at`, `updated_at`

**Membership table (`SiddesSetMember`)**
- **Path:** `backend/siddes_sets/models.py`
- Purpose: join-friendly membership checks.
- Fields:
  - `set` FK → SiddesSet
  - `member_id: string`

**Event model (`SiddesCircleEvent`)**
- **Path:** `backend/siddes_sets/models.py`
- Fields:
  - `id` (string PK)
  - `set` FK
  - `ts_ms` (ms)
  - `kind` (`created|renamed|members_updated|moved_side|recolored`)
  - `by: string`
  - `data: JSON dict`

---

## 2) API layer (endpoints + request/response shapes)

### 2.1 Endpoints (backend DRF)
**URLConf:** `backend/siddes_sets/urls.py`

- `GET  /api/circles?side=<optional>` — list Circles visible to viewer
- `POST /api/circles` — create one Circle OR bulk-create via `inputs[]`
- `GET  /api/circles/<id>` — get Circle details (membership-gated)
- `PATCH /api/circles/<id>` — update label/members/side/color (owner-only)
- `DELETE /api/circles/<id>` — delete Circle (owner-only)
- `GET  /api/circles/<id>/events` — Circle event log (membership-gated)

**Backend views:** `backend/siddes_sets/views.py`

### 2.2 Next.js proxy endpoints (same-origin)
These mirror the backend endpoints and forward cookies/headers via `proxyJson`.

- `frontend/src/app/api/circles/route.ts` (GET, POST)
- `frontend/src/app/api/circles/[id]/route.ts` (GET, PATCH, DELETE)
- `frontend/src/app/api/circles/[id]/events/route.ts` (GET)

Proxy core:
- `frontend/src/app/api/auth/_proxy.ts`

### 2.3 Response envelope (Circles APIs)
The Circles API uses a consistent envelope with `ok` + `restricted`.

**List response:**
```json
{ "ok": true, "restricted": false, "viewer": "me_1", "role": "me", "items": [SetItem...] }
```

**Restricted list (no viewer):** HTTP 200
```json
{ "ok": true, "restricted": true, "viewer": null, "role": "anon", "items": [] }
```

**Detail response:**
```json
{ "ok": true, "restricted": false, "viewer": "me_1", "role": "me", "item": SetItem }
```

**Restricted detail (not readable):** HTTP 200 (existence-safe)
```json
{ "ok": true, "restricted": true, "viewer": "me_1", "role": "friends", "item": null }
```

**Events response:**
```json
{ "ok": true, "restricted": false, "viewer": "me_1", "role": "me", "items": [CircleEventItem...] }
```

### 2.4 SetItem contract (what the UI expects)
Produced by backend store and coerced in `frontend/src/lib/setsProviders/backendStub.ts`:

```json
{
  "id": "gym",
  "side": "friends",
  "label": "Gym Squad",
  "color": "orange",
  "members": ["@marc_us", "@sara_j"],
  "count": 0
}
```

### 2.5 CircleEventItem contract
Produced by backend store and coerced in `frontend/src/lib/setsProviders/backendStub.ts`:

```json
{
  "id": "se_1700000000000_ab12cd",
  "setId": "gym",
  "kind": "members_updated",
  "ts": 1700000000000,
  "by": "@jordan",
  "data": { "from": ["@a"], "to": ["@a","@jordan"], "via": "invite", "inviteId": "inv_..." }
}
```

### 2.6 Write request bodies (create / bulk / patch)

**Create one:** `POST /api/circles`
```json
{ "side": "friends", "label": "Weekend Crew", "members": ["@a","@b"], "color": "purple" }
```

**Bulk create:** `POST /api/circles`
```json
{ "inputs": [
  { "side": "friends", "label": "Gym", "members": ["@a"], "color": "orange" },
  { "side": "work", "label": "Team", "members": ["@x"], "color": "slate" }
]}
```

**Patch:** `PATCH /api/circles/<id>`
```json
{ "label": "New Name", "members": ["@a","@b"], "side": "close", "color": "rose" }
```

---

## 3) Backend storage + membership enforcement (where “truth” lives)

### 3.1 Store selection (DB vs in-memory dev fallback)
**Path:** `backend/siddes_sets/views.py`

Circles endpoints route to a `_store` chosen at startup:
- `DbSetsStore()` in `backend/siddes_sets/store_db.py`
- `InMemoryApiSetsStore()` in `backend/siddes_sets/store_memory_api.py`

Selection is controlled by:
- `DEBUG` and env `SD_SETS_STORE` (`auto|db|memory`)
- Production hard rule: when `DEBUG=False`, it forces **DB mode**.

### 3.2 Visibility rule (reads)
**Path:** `backend/siddes_sets/views.py` + `backend/siddes_sets/store_db.py`

Read rule (v0): viewer can read a Circle if:
- viewer is the **owner**, OR
- viewer is listed as a **member**

DB mode checks membership via:
- `SiddesSetMember` table (fast path), then
- JSON list `SiddesSet.members` fallback (pre-migration safety)

### 3.3 Identity normalization (why membership checks work)
**Path:** `backend/siddes_backend/identity.py`

`viewer_aliases(viewer_id)` expands a viewer token into aliases:
- always includes the token itself (e.g. `me_1`)
- if token is `me_<id>` and user exists, also includes `@username`
- if token is a handle, includes normalized handle

This allows membership stored as `@username` (invites) to match a session viewer `me_1`.

### 3.4 Writes (create/update/delete) are owner-only
**Path:** `backend/siddes_sets/views.py`

Write rule (v0):
- Missing viewer → 401 restricted
- Non-`me` role → 403 restricted

(“role” is derived via `resolve_viewer_role` from `backend/siddes_inbox/visibility_stub.py`.)

### 3.5 Circle Events are server-truth
**Path:** `backend/siddes_sets/store_db.py`

Events are written when:
- Circle created
- Label changed
- Members changed
- Side moved
- Color changed

Events are returned only if the Circle is readable (avoid existence leaks).

---

## 4) Frontend provider layer (how UI talks to Circles)

### 4.1 Provider implementation
- **Path:** `frontend/src/lib/setsProvider.ts`
- Currently hard-wired to: `backendStubProvider` in `frontend/src/lib/setsProviders/backendStub.ts`

### 4.2 Network behavior
**All calls are same-origin** (`/api/*`) and hit Next route handlers.

Provider methods:
- `list({side})` → `GET /api/circles?side=...`
- `get(id)` → `GET /api/circles/<id>`
- `create(input)` → `POST /api/circles` (single)
- `bulkCreate(inputs)` → `POST /api/circles` with `{inputs:[...]}`
- `update(id, patch)` → `PATCH /api/circles/<id>`
- `events(id)` → `GET /api/circles/<id>/events`

### 4.3 Coercion/validation on the client
**Path:** `frontend/src/lib/setsProviders/backendStub.ts`

The UI is defensive: it coerces incoming data into the expected unions:
- valid sides: `public|friends|close|work`
- valid colors: `orange|purple|blue|emerald|rose|slate`
- event kinds: `created|renamed|members_updated|moved_side|recolored`

---

## 5) UI surfaces (where Circles appear)

### 5.1 Circles list page — `/siddes-circles`
**Path:** `frontend/src/app/siddes-circles/page.tsx`

Purpose: list Circles (optional side-filter), create new sets, import from contacts, accept suggested sets.

Main state dependencies:
- `useSearchParams`, `useMemo(getCirclesProvider)`, `useState`, `useEffect`
- `onCirclesChanged(...)` refresh trigger
- Theme tokens: `SIDE_THEMES`, `SIDES`, `getCircleTheme`

Atomic building blocks used:
- `SuggestedCirclesTray` — review/accept suggested sets
- `CreateCircleSheet` — guided set creator (multi-step)
- `ImportCircleSheet` — contact-sync import flow (dev-only UI gate)

### 5.2 Circle detail page — `/siddes-circles/[id]`
**Path:** `frontend/src/app/siddes-circles/[id]/page.tsx`

Purpose: show and edit a Circle, view Circle events, manage outgoing invites.

State dependencies:
- `useMemo(getCirclesProvider)`, `useMemo(getInviteProvider)`, `useState`, `useEffect`
- `onCirclesChanged(...)` refresh trigger

Couplings:
- Outgoing invites list uses `invitesProvider.list({direction:"outgoing"})` and filters by `setId`.
- Invite UX uses `InviteActionSheet` + `InviteList`.

### 5.3 Feed integration — set filter + compose audience
**File:** `frontend/src/components/SideFeed.tsx`

Key integration points:
- Maintains `activeSet: CircleId|null`
- Uses `CirclePickerSheet` to choose a Circle filtered to current Side
- Filters feed posts client-side: when `activeSet` is set, keeps only posts where `post.setId === activeSet`
- Persists last Circle per Side: `frontend/src/lib/audienceStore.ts` (`sd.feed.lastSet.<side>`)
- Composer link includes `set=<activeSet>` query param for audience intent

### 5.4 Compose integration — selecting Circle for the new post
**File:** `frontend/src/app/siddes-compose/client.tsx`

Key integration points:
- Maintains `selectedCircleId`
- Applies audience intent from query params: `?set=<id>&side=<side>`
- `POST /api/post` includes `setId: selectedCircleId` in request body

### 5.5 Desktop quick access — Right rail Circles list
**File:** `frontend/src/components/DesktopRightRail.tsx`

Purpose: show first ~6 Circles for active Side (XL breakpoint).

State dependencies:
- `useSide()` + `useEffect` to refresh on Side changes
- `getCirclesProvider().list({side})`

### 5.6 Onboarding entrypoint — suggested Circles creation
**File:** `frontend/src/app/onboarding/page.tsx`

Uses `/api/circles` create/bulk-create and supports undo delete via `/api/circles/<id>`.

---

## 6) Interaction map (how Circles affect user journeys)

### 6.1 Circles list → Circle detail
- `/siddes-circles` renders each Circle row as a link: `/siddes-circles/<setId>`
- Detail page loads:
  - `setsProvider.get(setId)`
  - `setsProvider.events(setId)`

### 6.2 Feed Circle selection → filtered feed → compose intent
- `SideFeed` header opens `CirclePickerSheet`
- Selecting a Circle updates `activeSet`
- Feed list is filtered to posts with matching `setId`
- Compose button pushes `/siddes-compose?...&set=<activeSet>`

### 6.3 Compose → post create (Circle-scoped)
- Composer sends `setId` in `/api/post` payload.
- Backend (`backend/siddes_post/views.py`) enforces:
  - viewer must be able to view/participate in that Circle
  - the post side is aligned to the Circle side (Circle.side is truth)

### 6.4 Invite accept → membership changes → UI refresh
- Invite accept flow (`invitesProvider.act(..., "accept")`) calls `emitCirclesChanged()`
- Pages subscribed via `onCirclesChanged(...)` refresh list/detail.

---

## 7) Guardrails & invariants (structural locations)

### 7.1 “Blue reserved for Public” (Circle theming)
- `frontend/src/lib/setThemes.ts` maps `blue` to slate-ish classes.
- `frontend/src/lib/sets.ts` `safeSet()` remaps stored `blue` → `slate`.
- `frontend/src/components/CreateCircleSheet.tsx` excludes `blue` from theme picker.

### 7.2 Default-safe reads (avoid existence leaks)
- Circles `GET`/`events` return **restricted payload (HTTP 200)** with `item:null` or `items:[]` when unreadable.
- This prevents a non-member from distinguishing “doesn’t exist” vs “exists but private”.

### 7.3 Writes are owner-only (server enforced)
- `POST/PATCH/DELETE` require authenticated viewer with role `me`.

---

## 8) Third-party tissue (where external dependencies touch Circles)

### 8.1 Frontend
- **Next.js App Router** (pages + route handlers): `frontend/src/app/...`
- **lucide-react** icons:
  - Circles pages and sheets (e.g. `Plus`, `RefreshCcw`, `Save`, `Users`)
- **TailwindCSS** for all UI tokens and themes.

### 8.2 Local intelligence (suggested Circles)
- On-device clustering: `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- Local suggestion cache: `frontend/src/lib/localIntelligence/localSuggestedCirclesCache.ts`
- Local ledger (accept/dismiss): `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`

### 8.3 Telemetry
- Suggested Circles tray emits events via: `frontend/src/lib/telemetry/sdTelemetry.ts`

### 8.4 Backend
- **Django + DRF** for endpoints
- **Postgres/ORM** for persistence (`DbSetsStore`)
- JSONField for `members` (payload parity) + normalized membership table for indexable checks.

---

## 9) Call-site index (searchable wiring map)

### 9.1 Files calling `getCirclesProvider()`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/app/siddes-invites/page.tsx`
- `frontend/src/app/siddes-post/[id]/page.tsx`
- `frontend/src/app/siddes-circles/page.tsx`
- `frontend/src/app/siddes-circles/[id]/page.tsx`
- `frontend/src/components/DesktopRightRail.tsx`
- `frontend/src/components/SideFeed.tsx`

### 9.2 Files fetching `/api/circles` directly (not via provider)
- `frontend/src/components/SuggestedCirclesTray.tsx`
- `frontend/src/app/onboarding/page.tsx`
- Provider itself: `frontend/src/lib/setsProviders/backendStub.ts`
- Next handlers: `frontend/src/app/api/circles/**`

### 9.3 Files rendering `CirclePickerSheet`
- `frontend/src/components/SideFeed.tsx`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/components/CircleFilterBar.tsx` → `CirclePickerSheet`

### 9.4 Backend modules that import/consult Circles (coupling points)
- Posts: `backend/siddes_post/views.py` (set meta + membership gates)
- Feed: `backend/siddes_feed/feed_stub.py` (set-based privacy filtering)
- Invites: `backend/siddes_invites/store_db.py` (accept adds member + emits CircleEvent)
- Rituals: `backend/siddes_rituals/views.py` (set-scoped rituals)
- Prism: `backend/siddes_prism/views.py` (shared Circles display)
- Auth lifecycle/export: `backend/siddes_auth/views.py`, `backend/siddes_auth/account_lifecycle.py`
- ML: `backend/siddes_ml/views.py` (reads Circles for suggestions)

---

## 10) Suggested next zoom targets (Phase 2.6+)
If we continue in the same Spider Pack style, the natural next blocks are:
1) **Inbox deep dive** — `backend/siddes_inbox/*` + `/siddes-inbox/*`
2) **Safety + Moderation deep dive** — blocks/mutes/reports/appeals and admin surfaces
3) **Notifications deep dive**
