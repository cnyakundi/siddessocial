# Phase 2.4 — Visibility & Privacy Enforcement Spider Pack (Siddes)

**Scope:** Map **where** and **how** Siddes enforces “who can see what” across **Frontend → Next API Proxy → Django/DRF**.

- This is **structural + data-contract mapping** (no fixes/refactors).
- Focus is **privacy / authorization / visibility**.

---

## 0) The Visibility Contract (system invariants)

### 0.1 Default-safe identity
Siddes treats a **missing/unknown viewer** as the safest case:
- API list endpoints return **`{ ok:true, restricted:true, ... }`** with **empty content**.
- Some detail endpoints return **`404 not_found`** to **avoid existence leaks**.

### 0.2 “Server truth > client illusion”
Client-side Side selection and UI gating are **assistive**, not authoritative.
The backend enforces privacy rules before returning any private content.

### 0.3 Side semantics
- `public`: readable (subject to moderation/safety filters).
- `friends|close|work`: treated as **private**; in this codebase, private reads are primarily enforced via **Circle membership**.

### 0.4 Circle-scoped privacy is the current production-grade fence
For non-public posts, the “launch-safe” rule is:
- **Author can always view**
- **Circle membership required** when `set_id` exists
- **Non-public posts without a set** are **author-only** (fail closed)

### 0.5 Safety + moderation overlays
Visibility is additionally constrained by:
- **Blocks (either direction)**: hard stop on seeing/interacting
- **Mutes (one-way)**: filter in some surfaces (feed/search/notifications)
- **Hidden posts**: only author or staff can see

### 0.6 Response modes you’ll see in the APIs
Siddes uses three main response modes for visibility:

**Mode A — “restricted payload” (HTTP 200)**
- `restricted:true` and empty content (`items:[]`, `item:null`, etc.)
- Used heavily to avoid leaking details.

**Mode B — “not found” (HTTP 404)**
- `error:not_found` even when an object exists but is not viewable.
- Used for posts (and some write ops) to hide existence.

**Mode C — “restricted write” (HTTP 401/403)**
- Used for mutations (create/edit/delete) when viewer missing or not role `me`.

---

## 1) Canonical visibility modules (where the rules live)

### 1.1 Relationship-graph policy (not yet wired into feed)
- **Purpose:** clean relationship-based policy (`friends/close/work` sets).
- **Status:** present as a canonical policy module, but **feed/post views currently use Circle-based gating**.
- **Files:**
  - `backend/siddes_visibility/policy.py`
  - `backend/siddes_visibility/demo.py`

### 1.2 Post visibility (server truth today)
- **Feed filtering + hydration:**
  - `backend/siddes_feed/views.py` (viewer gate + restricted payload)
  - `backend/siddes_feed/feed_stub.py` (**actual visibility filtering** via `_can_view_record`)
- **Post detail/replies/actions:**
  - `backend/siddes_post/views.py` (helpers `_can_view_post_record`, `_set_meta`, staff override)

### 1.3 Circle membership + Side alignment (prevents cross-side leakage)
- **Circle model (owns `side`, `members`):** `backend/siddes_sets/models.py`
- **Membership store / join checks:** `backend/siddes_sets/store_db.py`
- **Circle read rules (owner OR member):** `backend/siddes_sets/views.py`

### 1.4 Safety policy (blocks + mutes)
- **Functions:** `is_blocked_pair`, `is_muted`, token normalization.
- **File:** `backend/siddes_safety/policy.py`

### 1.5 Inbox visibility (role-based stub fence)
Inbox uses a deterministic **role → allowed sides** model to prevent leaks before a full graph exists.
- Backend: `backend/siddes_inbox/visibility_stub.py`
- Frontend mirror (for Next stub stores): `frontend/src/lib/server/inboxVisibility.ts`

### 1.6 Media visibility (private media allowed only if you can view the post)
- File: `backend/siddes_media/views.py`
- Uses post visibility helpers: imports `_set_meta` + `_can_view_post_record` from `backend/siddes_post/views.py`

### 1.7 Public search visibility
- File: `backend/siddes_search/views.py`
- Enforces: `side="public"` + `is_hidden=False` + mute filtering.

---

## 2) Identity gate (viewer resolution) — end-to-end wiring

### 2.1 Next.js proxy (frontend → backend)
The Next API layer proxies to Django and is the **bridge where identity must not be spoofable**.
- **Cookie forwarding:** always forwards `cookie` (session cookies) to Django.
- **Dev viewer forwarding:** forwards `x-sd-viewer` only when `NODE_ENV !== "production"`.
- **File:** `frontend/src/app/api/auth/_proxy.ts`

### 2.2 Backend viewer resolution pattern
Most backend feature views share this pattern:
1) If `request.user.is_authenticated`: viewer becomes `me_<django_user_id>`
2) Else if `DEBUG=True`: accept dev viewer via `x-sd-viewer` header or `sd_viewer` cookie
3) Else (prod): return `None` (fail closed)

**Files containing `_raw_viewer_from_request`:**
- `backend/siddes_feed/views.py`
- `backend/siddes_post/views.py`
- `backend/siddes_sets/views.py`
- `backend/siddes_media/views.py`
- `backend/siddes_search/views.py`
- `backend/siddes_notifications/views.py`
- `backend/siddes_rituals/views.py`
- `backend/siddes_invites/views.py`
- `backend/siddes_safety/views.py`
- `backend/siddes_ml/views.py`
- `backend/siddes_broadcasts/views.py`

Inbox uses the same rule but names it `get_viewer_id()`:
- `backend/siddes_inbox/views.py`

### 2.3 Viewer role derivation (stub universe)
Many endpoints compute `role = resolve_viewer_role(viewer)`, where role is one of:
`anon | friends | close | work | me`
- **File:** `backend/siddes_inbox/visibility_stub.py`

Frontend-side helper for stub viewer cookie:
- `frontend/src/lib/stubViewerClient.ts`
- `frontend/src/lib/server/stubViewer.ts` (Next stub routes)

---

## 3) Post visibility — how Feed and Post Detail enforce privacy

### 3.1 Feed: GET /api/feed
**Request path:**
1) Browser → Next `/api/feed` (same-origin)
2) Next proxies → Django `GET /api/feed?side=...`

**Backend gate:**
- If viewer missing: returns **Mode A** restricted payload with `items:[]`.
- Else: calls `list_feed(...)`.

**Files:**
- `backend/siddes_feed/views.py` (restricted payload + caching)
- `backend/siddes_feed/feed_stub.py` (scan/filter/hydrate)

### 3.2 Feed filtering function (the actual fence): `_can_view_record`
**File:** `backend/siddes_feed/feed_stub.py`

Decision outline (server truth for feed):
1) **Hidden posts**: if `is_hidden=True`, allow only author or staff.
2) **Blocks**: if blocked pair, deny unless author or staff.
3) **Mutes**: if viewer muted author, deny unless it’s the viewer’s own content.
4) **Author always allowed**.
5) **Public allowed**.
6) **Non-public**:
   - If `set_id` present: require Circle membership (`_set_allows`).
   - If `set_id` missing: deny (author-only).

Also note:
- Broadcast Circle IDs (`set_id` starting with `b_`) are treated as public-readable channels in `_set_allows`.

### 3.3 Post detail: GET /api/post/<id>
**File:** `backend/siddes_post/views.py` (`PostDetailView.get`)

**Existence leak prevention:**
- If a post exists but viewer cannot see it, the endpoint returns **Mode B** `404 not_found`.

**Gates applied in order (structural):**
1) Require viewer + post_id (otherwise 404)
2) `POST_STORE.get(post_id)` (if missing → 404)
3) `_set_meta(viewer, rec.set_id)` must pass (otherwise 404)
4) If Circle has a `side`, it must match `rec.side` (otherwise 404)
5) `_can_view_post_record(...)` must pass (otherwise 404)
6) Return `{ ok:true, post:<FeedPost>, side:<side> }`

### 3.4 Replies list: GET /api/post/<id>/replies
**File:** `backend/siddes_post/views.py` (`PostRepliesView.get`)

Gates mirror PostDetail:
- Viewer required
- Post exists
- Circle is viewable
- `_can_view_post_record` passes

### 3.5 Key helper: `_can_view_post_record` (post/detail fence)
**File:** `backend/siddes_post/views.py`

Decision outline:
1) Block pair denies (unless author/staff)
2) Hidden posts: allow only author/staff
3) Author always allowed
4) Public allowed
5) Non-public:
   - If `set_id` present: require `_set_meta` membership
   - Else: deny (author-only)

**Important structural note:**
- Feed adds **mute filtering**; post/detail helper does **not**.

### 3.6 Call sites for post visibility helper
- Defined: `backend/siddes_post/views.py:_can_view_post_record`
- Called in:
  - `backend/siddes_post/views.py` (detail, replies, like/echo/quote/reply/create flows)
  - `backend/siddes_media/views.py` (private media authorization)

---

## 4) Circles as a visibility boundary (membership + side alignment)

### 4.1 Circle model fields used for visibility
- `SiddesSet.side` (SideId) — prevents cross-side leakage
- `SiddesSet.owner_id`
- `SiddesSet.members` (JSON contract parity)
- `SiddesSetMember` join table (fast membership checks)

**File:** `backend/siddes_sets/models.py`

### 4.2 Circle membership enforcement used by posts
Posts use Circle membership in two slightly different helpers:

- Feed: `_set_allows(viewer_id, set_id)`
  - File: `backend/siddes_feed/feed_stub.py`
  - Checks owner, then `SiddesSetMember`, then JSON fallback.

- Post detail/actions: `_set_meta(viewer_id, set_id) -> (ok, set_side)`
  - File: `backend/siddes_post/views.py`
  - Same membership semantics + returns the Circle’s `side` for alignment checks.

### 4.3 Circle read endpoints avoid leaks
- `GET /api/circles/<id>` returns **Mode A** restricted payload with `item:null` when not readable.
- `GET /api/circles/<id>/events` returns restricted payload with `items:[]` when not readable.

**File:** `backend/siddes_sets/views.py`

---

## 5) Safety + moderation overlays (visibility modifiers)

### 5.1 Blocks (hard stop)
**Policy function:** `backend/siddes_safety/policy.py:is_blocked_pair`

**Call sites (visibility impact):**
- `backend/siddes_feed/feed_stub.py` (filters blocked authors)
- `backend/siddes_post/views.py` (denies on blocked pair)
- `backend/siddes_inbox/views.py` (filters/restricts blocked threads)
- `backend/siddes_rituals/views.py` (filters ritual items)

### 5.2 Mutes (soft stop in certain surfaces)
**Policy function:** `backend/siddes_safety/policy.py:is_muted`

**Call sites:**
- `backend/siddes_feed/feed_stub.py` (filters muted authors)
- `backend/siddes_search/views.py` (filters muted authors)
- `backend/siddes_notifications/views.py` (mute-aware filtering)

### 5.3 Hidden posts (moderation gate)
Hidden state lives on the Post record:
- `Post.is_hidden` (db-indexed)
- File: `backend/siddes_post/models.py`

Enforced in:
- `backend/siddes_feed/feed_stub.py` (`_can_view_record`)
- `backend/siddes_post/views.py` (`_can_view_post_record`)
- `backend/siddes_media/views.py` (`_viewer_can_view_post`)
- `backend/siddes_search/views.py` (search excludes `is_hidden=True`)

Hidden toggling endpoint lives in Safety views:
- `backend/siddes_safety/views.py` (post hide/unhide)

### 5.4 Staff override
Backend helper:
- `_viewer_is_staff(viewer_id)`

Used to allow staff to view hidden/blocked content in feed/post visibility logic.

---

## 6) Inbox visibility model (threads/messages)

### 6.1 Role-based Side access (stub fence)
Inbox uses a deterministic mapping:
- viewer string → role (`anon|friends|close|work|me`)
- role → allowed sides

**Backend:** `backend/siddes_inbox/visibility_stub.py`
**Frontend mirror:** `frontend/src/lib/server/inboxVisibility.ts`

### 6.2 Locked-side enforcement
Inbox threads have a `locked_side` and stores check `role_can_view(role, locked_side)`.

**Primary enforcement points:**
- `backend/siddes_inbox/store_db.py` (multiple checks)
- `backend/siddes_inbox/store_memory.py` (same policy wrapper)

### 6.3 Block enforcement for inbox
Inbox explicitly filters/restricts threads if either party has blocked the other.

**File:** `backend/siddes_inbox/views.py`
- `_filter_blocked_threads_payload` (list)
- `_restrict_blocked_thread_payload` (detail)

---

## 7) Frontend: how “restricted” is handled in UI (brain + guardrails)

### 7.1 Shared restricted detection
**File:** `frontend/src/lib/restricted.ts`
- `isRestrictedPayload(res, data)` detects:
  - HTTP 401/403
  - `data.restricted === true`
  - `{ ok:false, error:"restricted" }`

### 7.2 Feed uses RestrictedError (hard stop)
- Provider throws `RestrictedError` when payload is restricted.
- UI surfaces can show “sign in” state rather than “empty feed”.

**Files:**
- `frontend/src/lib/feedProviders/backendStub.ts`
- `frontend/src/components/SideFeed.tsx`

### 7.3 Post detail treats non-view as not-found
`/siddes-post/[id]` calls `/api/post/<id>`; on non-OK or `ok:false`, it shows “Post not found / you might not have access”.

**File:** `frontend/src/app/siddes-post/[id]/page.tsx`

### 7.4 Side mismatch is a UX guardrail, not an auth fence
Post detail shows a banner if the post’s side differs from active side.
- It guides “Enter side” for safe replying.

**File:** `frontend/src/app/siddes-post/[id]/page.tsx` (`SideMismatchBanner`)

### 7.5 AuthBootstrap protects routes at the shell level
Protected Siddes routes are redirected to `/login` when `/api/auth/me` reports unauth.

**File:** `frontend/src/components/AuthBootstrap.tsx`

---

## 8) Visibility-sensitive endpoint inventory (where these rules apply)

### 8.1 Core content
- **Feed (list):** `GET /api/feed?side=...`
  - Backend: `backend/siddes_feed/views.py` + `feed_stub.py`
  - Mode A when viewer missing

- **Post detail:** `GET /api/post/<id>`
  - Backend: `backend/siddes_post/views.py`
  - Mode B when not viewable (404 not_found)

- **Replies list:** `GET /api/post/<id>/replies`
  - Backend: `backend/siddes_post/views.py`
  - Mode B when not viewable (404 not_found)

### 8.2 Circles (membership boundary)
- `GET /api/circles` → Mode A when viewer missing
- `GET /api/circles/<id>` → Mode A when not readable (item:null)
- `GET /api/circles/<id>/events` → Mode A when not readable (items:[])

**Backend:** `backend/siddes_sets/views.py`

### 8.3 Inbox (role + blocks)
- `GET /api/inbox/threads` → Mode A restricted payload when viewer missing
- `GET /api/inbox/thread/<id>` → restricted payload when viewer missing/blocked

**Backend:** `backend/siddes_inbox/views.py`

### 8.4 Media (private attachments)
- `GET /api/media/url?key=...`
  - Public: allowed
  - Private: owner OR can view attached post
  - Mode A when viewer missing (private)
  - 403 forbidden when viewer cannot view attached post

**Backend:** `backend/siddes_media/views.py`

### 8.5 Public search
- `GET /api/search/posts?q=...` returns only:
  - `side="public"`
  - `is_hidden=False`
  - muted authors excluded

**Backend:** `backend/siddes_search/views.py`

---

## 9) Third-party / infrastructure tissue (visibility-relevant)

### 9.1 Django SessionAuthentication
Production identity is cookie-based session auth; dev viewer is ignored when `DEBUG=False`.

### 9.2 Feed caching is keyed to avoid leaks
Feed cache key includes `viewer + role + side + topic + cursor + limit`.

**File:** `backend/siddes_feed/views.py` (cache key + TTL)

### 9.3 R2 / signed URL strategy
- In prod: `/m/*` should route to a Cloudflare Worker.
- In dev: Django provides signed URL redirect.

**File:** `backend/siddes_media/views.py`

---

## 10) Suggested next zoom targets (Phase 2.5+)
If we continue in the same “Spider Pack” style, the natural next blocks are:
1) **Circles deep dive** (membership, events, side moves, contracts) — `backend/siddes_sets/*` + `frontend` sets surfaces
2) **Inbox deep dive** (threads/messages, locked sides, blocks enforcement) — `backend/siddes_inbox/*` + `/siddes-inbox/*`
3) **Safety deep dive** (blocks/mutes/reports/appeals/mod actions) — `backend/siddes_safety/*` + `/siddes-settings/*`
