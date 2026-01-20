# Phase 2.5 — Sets Spider Pack (Siddes)

**Scope:** The complete Sets subsystem: **Set definitions → membership → events/history → create/update/delete → UI surfaces (Sets pages, feed filter, compose audience) → coupling points (Invites, Posts, Rituals, Prism)**.

**Operating mode:** Structural + data-contract mapping only (no fixes/refactors).

---

## 0) What a Set is in Siddes

A **Set** is a **user-curated subgroup inside a Side** (Public/Friends/Close/Work). In this codebase, Sets are the main privacy fence for private content:

- **Sets belong to a Side** (`set.side`).
- **Sets have a membership list** (`set.members` as handles/tokens).
- **Set-scoped content inherits Set side** (server truth) and requires membership to read.

There are also **Set Events** (audit/history) used to show changes such as renamed, moved side, members updated, recolored.

---

## 1) Canonical Set DNA (types + stored models)

### 1.1 Frontend canonical types

**Set type (`SetDef`)**
- **Path:** `frontend/src/lib/sets.ts`
- Fields:
  - `id: string`
  - `side: SideId` (`public|friends|close|work`)
  - `label: string`
  - `color: SetColor` (`orange|purple|blue|emerald|rose|slate`)
  - `members: string[]` (handles like `@name`, plus other viewer tokens in practice)
  - `count: number` (UI hint)

**Set Events (`SetEvent`)**
- **Path:** `frontend/src/lib/setEvents.ts`
- Fields:
  - `id: string`
  - `setId: string`
  - `kind: SetEventKind` = `created|renamed|members_updated|moved_side|recolored`
  - `ts: number` (ms)
  - `by: string`
  - `data?: Record<string,any>`

**Sets Provider contract (`SetsProvider`)**
- **Path:** `frontend/src/lib/setsProvider.ts`
- Methods:
  - `list({side?}) → SetDef[]`
  - `get(id) → SetDef|null`
  - `create({side?,label,members,color?}) → SetDef`
  - `bulkCreate(inputs[]) → SetDef[]`
  - `update(id, patch) → SetDef|null`
  - `events(id) → SetEvent[]`

### 1.2 Frontend theme tokens for Sets

**Set theme tokens**
- **Path:** `frontend/src/lib/setThemes.ts`
- `SET_THEMES[color] = { bg, text, border }`
- Note: **blue is reserved for Public**; the Set theme for `blue` renders as slate-ish classes.

### 1.3 Backend canonical storage models

**Set model (`SiddesSet`)**
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

**Event model (`SiddesSetEvent`)**
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

- `GET  /api/sets?side=<optional>` — list Sets visible to viewer
- `POST /api/sets` — create one Set OR bulk-create via `inputs[]`
- `GET  /api/sets/<id>` — get Set details (membership-gated)
- `PATCH /api/sets/<id>` — update label/members/side/color (owner-only)
- `DELETE /api/sets/<id>` — delete Set (owner-only)
- `GET  /api/sets/<id>/events` — Set event log (membership-gated)

**Backend views:** `backend/siddes_sets/views.py`

### 2.2 Next.js proxy endpoints (same-origin)
These mirror the backend endpoints and forward cookies/headers via `proxyJson`.

- `frontend/src/app/api/sets/route.ts` (GET, POST)
- `frontend/src/app/api/sets/[id]/route.ts` (GET, PATCH, DELETE)
- `frontend/src/app/api/sets/[id]/events/route.ts` (GET)

Proxy core:
- `frontend/src/app/api/auth/_proxy.ts`

### 2.3 Response envelope (Sets APIs)
The Sets API uses a consistent envelope with `ok` + `restricted`.

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
{ "ok": true, "restricted": false, "viewer": "me_1", "role": "me", "items": [SetEventItem...] }
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

### 2.5 SetEventItem contract
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

**Create one:** `POST /api/sets`
```json
{ "side": "friends", "label": "Weekend Crew", "members": ["@a","@b"], "color": "purple" }
```

**Bulk create:** `POST /api/sets`
```json
{ "inputs": [
  { "side": "friends", "label": "Gym", "members": ["@a"], "color": "orange" },
  { "side": "work", "label": "Team", "members": ["@x"], "color": "slate" }
]}
```

**Patch:** `PATCH /api/sets/<id>`
```json
{ "label": "New Name", "members": ["@a","@b"], "side": "close", "color": "rose" }
```

---

## 3) Backend storage + membership enforcement (where “truth” lives)

### 3.1 Store selection (DB vs in-memory dev fallback)
**Path:** `backend/siddes_sets/views.py`

Sets endpoints route to a `_store` chosen at startup:
- `DbSetsStore()` in `backend/siddes_sets/store_db.py`
- `InMemoryApiSetsStore()` in `backend/siddes_sets/store_memory_api.py`

Selection is controlled by:
- `DEBUG` and env `SD_SETS_STORE` (`auto|db|memory`)
- Production hard rule: when `DEBUG=False`, it forces **DB mode**.

### 3.2 Visibility rule (reads)
**Path:** `backend/siddes_sets/views.py` + `backend/siddes_sets/store_db.py`

Read rule (v0): viewer can read a Set if:
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

### 3.5 Set Events are server-truth
**Path:** `backend/siddes_sets/store_db.py`

Events are written when:
- Set created
- Label changed
- Members changed
- Side moved
- Color changed

Events are returned only if the Set is readable (avoid existence leaks).

---

## 4) Frontend provider layer (how UI talks to Sets)

### 4.1 Provider implementation
- **Path:** `frontend/src/lib/setsProvider.ts`
- Currently hard-wired to: `backendStubProvider` in `frontend/src/lib/setsProviders/backendStub.ts`

### 4.2 Network behavior
**All calls are same-origin** (`/api/*`) and hit Next route handlers.

Provider methods:
- `list({side})` → `GET /api/sets?side=...`
- `get(id)` → `GET /api/sets/<id>`
- `create(input)` → `POST /api/sets` (single)
- `bulkCreate(inputs)` → `POST /api/sets` with `{inputs:[...]}`
- `update(id, patch)` → `PATCH /api/sets/<id>`
- `events(id)` → `GET /api/sets/<id>/events`

### 4.3 Coercion/validation on the client
**Path:** `frontend/src/lib/setsProviders/backendStub.ts`

The UI is defensive: it coerces incoming data into the expected unions:
- valid sides: `public|friends|close|work`
- valid colors: `orange|purple|blue|emerald|rose|slate`
- event kinds: `created|renamed|members_updated|moved_side|recolored`

---

## 5) UI surfaces (where Sets appear)

### 5.1 Sets list page — `/siddes-sets`
**Path:** `frontend/src/app/siddes-sets/page.tsx`

Purpose: list Sets (optional side-filter), create new sets, import from contacts, accept suggested sets.

Main state dependencies:
- `useSearchParams`, `useMemo(getSetsProvider)`, `useState`, `useEffect`
- `onSetsChanged(...)` refresh trigger
- Theme tokens: `SIDE_THEMES`, `SIDES`, `getSetTheme`

Atomic building blocks used:
- `SuggestedSetsTray` — review/accept suggested sets
- `CreateSetSheet` — guided set creator (multi-step)
- `ImportSetSheet` — contact-sync import flow (dev-only UI gate)

### 5.2 Set detail page — `/siddes-sets/[id]`
**Path:** `frontend/src/app/siddes-sets/[id]/page.tsx`

Purpose: show and edit a Set, view Set events, manage outgoing invites.

State dependencies:
- `useMemo(getSetsProvider)`, `useMemo(getInviteProvider)`, `useState`, `useEffect`
- `onSetsChanged(...)` refresh trigger

Couplings:
- Outgoing invites list uses `invitesProvider.list({direction:"outgoing"})` and filters by `setId`.
- Invite UX uses `InviteActionSheet` + `InviteList`.

### 5.3 Feed integration — set filter + compose audience
**File:** `frontend/src/components/SideFeed.tsx`

Key integration points:
- Maintains `activeSet: SetId|null`
- Uses `SetPickerSheet` to choose a Set filtered to current Side
- Filters feed posts client-side: when `activeSet` is set, keeps only posts where `post.setId === activeSet`
- Persists last Set per Side: `frontend/src/lib/audienceStore.ts` (`sd.feed.lastSet.<side>`)
- Composer link includes `set=<activeSet>` query param for audience intent

### 5.4 Compose integration — selecting Set for the new post
**File:** `frontend/src/app/siddes-compose/client.tsx`

Key integration points:
- Maintains `selectedSetId`
- Applies audience intent from query params: `?set=<id>&side=<side>`
- `POST /api/post` includes `setId: selectedSetId` in request body

### 5.5 Desktop quick access — Right rail Sets list
**File:** `frontend/src/components/DesktopRightRail.tsx`

Purpose: show first ~6 Sets for active Side (XL breakpoint).

State dependencies:
- `useSide()` + `useEffect` to refresh on Side changes
- `getSetsProvider().list({side})`

### 5.6 Onboarding entrypoint — suggested Sets creation
**File:** `frontend/src/app/onboarding/page.tsx`

Uses `/api/sets` create/bulk-create and supports undo delete via `/api/sets/<id>`.

---

## 6) Interaction map (how Sets affect user journeys)

### 6.1 Sets list → Set detail
- `/siddes-sets` renders each Set row as a link: `/siddes-sets/<setId>`
- Detail page loads:
  - `setsProvider.get(setId)`
  - `setsProvider.events(setId)`

### 6.2 Feed Set selection → filtered feed → compose intent
- `SideFeed` header opens `SetPickerSheet`
- Selecting a Set updates `activeSet`
- Feed list is filtered to posts with matching `setId`
- Compose button pushes `/siddes-compose?...&set=<activeSet>`

### 6.3 Compose → post create (Set-scoped)
- Composer sends `setId` in `/api/post` payload.
- Backend (`backend/siddes_post/views.py`) enforces:
  - viewer must be able to view/participate in that Set
  - the post side is aligned to the Set side (Set.side is truth)

### 6.4 Invite accept → membership changes → UI refresh
- Invite accept flow (`invitesProvider.act(..., "accept")`) calls `emitSetsChanged()`
- Pages subscribed via `onSetsChanged(...)` refresh list/detail.

---

## 7) Guardrails & invariants (structural locations)

### 7.1 “Blue reserved for Public” (Set theming)
- `frontend/src/lib/setThemes.ts` maps `blue` to slate-ish classes.
- `frontend/src/lib/sets.ts` `safeSet()` remaps stored `blue` → `slate`.
- `frontend/src/components/CreateSetSheet.tsx` excludes `blue` from theme picker.

### 7.2 Default-safe reads (avoid existence leaks)
- Sets `GET`/`events` return **restricted payload (HTTP 200)** with `item:null` or `items:[]` when unreadable.
- This prevents a non-member from distinguishing “doesn’t exist” vs “exists but private”.

### 7.3 Writes are owner-only (server enforced)
- `POST/PATCH/DELETE` require authenticated viewer with role `me`.

---

## 8) Third-party tissue (where external dependencies touch Sets)

### 8.1 Frontend
- **Next.js App Router** (pages + route handlers): `frontend/src/app/...`
- **lucide-react** icons:
  - Sets pages and sheets (e.g. `Plus`, `RefreshCcw`, `Save`, `Users`)
- **TailwindCSS** for all UI tokens and themes.

### 8.2 Local intelligence (suggested Sets)
- On-device clustering: `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- Local suggestion cache: `frontend/src/lib/localIntelligence/localSuggestedSetsCache.ts`
- Local ledger (accept/dismiss): `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`

### 8.3 Telemetry
- Suggested Sets tray emits events via: `frontend/src/lib/telemetry/sdTelemetry.ts`

### 8.4 Backend
- **Django + DRF** for endpoints
- **Postgres/ORM** for persistence (`DbSetsStore`)
- JSONField for `members` (payload parity) + normalized membership table for indexable checks.

---

## 9) Call-site index (searchable wiring map)

### 9.1 Files calling `getSetsProvider()`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/app/siddes-invites/page.tsx`
- `frontend/src/app/siddes-post/[id]/page.tsx`
- `frontend/src/app/siddes-sets/page.tsx`
- `frontend/src/app/siddes-sets/[id]/page.tsx`
- `frontend/src/components/DesktopRightRail.tsx`
- `frontend/src/components/SideFeed.tsx`

### 9.2 Files fetching `/api/sets` directly (not via provider)
- `frontend/src/components/SuggestedSetsTray.tsx`
- `frontend/src/app/onboarding/page.tsx`
- Provider itself: `frontend/src/lib/setsProviders/backendStub.ts`
- Next handlers: `frontend/src/app/api/sets/**`

### 9.3 Files rendering `SetPickerSheet`
- `frontend/src/components/SideFeed.tsx`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/components/SetFilterBar.tsx` → `SetPickerSheet`

### 9.4 Backend modules that import/consult Sets (coupling points)
- Posts: `backend/siddes_post/views.py` (set meta + membership gates)
- Feed: `backend/siddes_feed/feed_stub.py` (set-based privacy filtering)
- Invites: `backend/siddes_invites/store_db.py` (accept adds member + emits SetEvent)
- Rituals: `backend/siddes_rituals/views.py` (set-scoped rituals)
- Prism: `backend/siddes_prism/views.py` (shared Sets display)
- Auth lifecycle/export: `backend/siddes_auth/views.py`, `backend/siddes_auth/account_lifecycle.py`
- ML: `backend/siddes_ml/views.py` (reads Sets for suggestions)

---

## 10) Suggested next zoom targets (Phase 2.6+)
If we continue in the same Spider Pack style, the natural next blocks are:
1) **Inbox deep dive** — `backend/siddes_inbox/*` + `/siddes-inbox/*`
2) **Safety + Moderation deep dive** — blocks/mutes/reports/appeals and admin surfaces
3) **Notifications deep dive**
