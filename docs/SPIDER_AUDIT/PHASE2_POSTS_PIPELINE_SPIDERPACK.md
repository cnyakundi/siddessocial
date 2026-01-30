# Phase 2.3 — Posts Pipeline Spider Pack (Siddes)

**Scope:** The complete “post lifecycle” from **Compose → Create → Feed → Post Detail → Interactions** (replies, likes, echo, quote-echo, edit/delete, media attachments).

**Operating mode:** Structural + data-contract mapping only (no fixes, no refactors).

---

## 1) The canonical post DNA (what a “post” is in Siddes)

### 1.1 Frontend canonical type: `FeedPost`
**Path:** `frontend/src/lib/feedTypes.ts`

A post in the UI is represented as `FeedPost`:
- **Identity:** `id`
- **Author display:** `author`, `handle`
- **Time:** `time` (compact relative like `5m`, `2h`)
- **Content:** `content`, `kind` (`text|image|link`)
- **Context metadata:** `setId?`, `publicChannel?`, `urgent?`, `trustLevel?`
- **Engagement:** `likeCount?`, `liked?`, `replyCount?`, `echoCount?`, `echoed?`
- **Echo linkage:** `echoOf?` (summary of the original)
- **Author affordances:** `canEdit?`, `canDelete?`, `editedAt?`
- **Media attachments:** `media?: {id,r2Key,kind,contentType?,url}[]`

### 1.2 Backend canonical storage model: `Post`
**Path:** `backend/siddes_post/models.py`

DB fields (truth at rest):
- `id` (string PK)
- `author_id` (viewer id, e.g. `me_1`)
- `side` (`public|friends|close|work`)
- `text`
- `set_id` (nullable)
- `public_channel` (nullable; public-only)
- `urgent` (bool)
- `is_hidden` (bool)
- `edited_at` (float seconds, nullable)
- `created_at` (float seconds)
- `client_key` (nullable) — idempotency per author
- `echo_of_post_id` (nullable) — enables Echo + Quote-Echo

### 1.3 Reply storage model: `Reply`
**Path:** `backend/siddes_post/models.py`

DB fields:
- `id` (string PK)
- `post` FK → Post (column accessible as `post_id`)
- `author_id`
- `text`
- `created_at` (float seconds)
- `status` (string; default `created`)
- `client_key` (nullable) — idempotency per (post, author)

### 1.4 Likes storage model: `PostLike`
**Path:** `backend/siddes_post/models.py`

DB fields:
- `post_id` (string, not FK)
- `viewer_id` (viewer id)
- `created_at` (float seconds)

---

## 2) The user journey map (UI routes → actions)

### 2.1 Feed → Post detail
- **Feed route:** `/siddes-feed` → renders `SideFeed` → `PostCard`
  - Page: `frontend/src/app/siddes-feed/page.tsx`
  - Component: `frontend/src/components/SideFeed.tsx`
  - Card: `frontend/src/components/PostCard.tsx`
- **Detail route:** `/siddes-post/[id]` → fetches post + replies, renders thread
  - Page: `frontend/src/app/siddes-post/[id]/page.tsx`

Navigation glue:
- `PostCard.openPost()` → `router.push(/siddes-post/${id})`
- `PostCard.openReply()` → `router.push(/siddes-post/${id}?reply=1)`

### 2.2 Compose → Create post
- **Compose route:** `/siddes-compose` (URL carries `side` and may carry `set` or `topic`)
  - Client: `frontend/src/app/siddes-compose/client.tsx`
- **Broadcast compose:** `/siddes-broadcasts/[id]/compose` (posts into broadcast set id)
  - Page: `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`

### 2.3 Interactions on a post card
All are initiated from `PostCard`:
- Like/unlike
- Echo/un-echo
- Quote-echo
- Edit
- Delete
- Share/copy

**Path:** `frontend/src/components/PostCard.tsx`

### 2.4 Thread interactions on detail page
- Reply composer (modal)
- Queued replies (offline)
- Sent replies (fetched list)

**Path:** `frontend/src/app/siddes-post/[id]/page.tsx` + `frontend/src/components/ReplyComposer.tsx`

---

## 3) Frontend building blocks (what renders the pipeline)

### 3.1 Feed surface — `SideFeed`
**Purpose:** Side-scoped feed rendering (cursor paging + virtualization) and audience filters.
- **State deps:** `useSide`, `useWindowVirtualizer`, `useRouter`, `useEffect/useState/useMemo`
- **Data source:** `getFeedProvider().listPage(side, { topic, limit, cursor })`
- **Path:** `frontend/src/components/SideFeed.tsx`

### 3.2 Feed provider — `backendStubProvider`
**Purpose:** Same-origin fetch of `/api/feed` with session cookies; throws `RestrictedError` when auth is missing.
- **Path:** `frontend/src/lib/feedProviders/backendStub.ts`

### 3.3 Post renderer — `PostCard`
**Purpose:** Present a `FeedPost` and expose post interactions (like/reply/echo/quote/edit/delete/share).
- **State deps:** `useRouter`, `useState`, `useMemo`
- **Path:** `frontend/src/components/PostCard.tsx`

### 3.4 Edit surface — `EditPostSheet`
**Purpose:** PATCH a post via `/api/post/:id` and update UI.
- **State deps:** `useState`, `useEffect`, `useMemo`, `useRef`
- **Path:** `frontend/src/components/EditPostSheet.tsx`

### 3.5 Actions surface — `PostActionsSheet`
**Purpose:** Post menu (copy/share/report/mute/block + edit/delete affordances).
- **State deps:** `useEffect`
- **Path:** `frontend/src/components/PostActionsSheet.tsx`

### 3.6 Post detail route
**Purpose:** Load one post and its replies, enforce “Side mismatch” UI guardrails, send replies.
- **State deps:** `useParams`, `useSearchParams`, `useSide`, `useEffect/useState/useCallback`
- **Paths:**
  - `frontend/src/app/siddes-post/[id]/page.tsx`
  - `frontend/src/components/ReplyComposer.tsx`

### 3.7 Offline post/reply queue
**Purpose:** Persist unsent writes to localStorage; flush with real API writes.
- **Path:** `frontend/src/lib/offlineQueue.ts`

### 3.8 Media upload helper (attachments)
**Purpose:** Stage R2 uploads via signed URLs; composer passes `mediaKeys` to `/api/post`.
- **Path:** `frontend/src/lib/mediaClient.ts`

---

## 4) Next API layer (same-origin routes for the post system)

All post-related client writes/read hit **Next route handlers** under `frontend/src/app/api/post/**`.
These handlers proxy to Django using `proxyJson()`.

### 4.1 Route handler inventory (posts)
- `POST /api/post` → Django `POST /api/post`
  - `frontend/src/app/api/post/route.ts`
- `GET /api/post/:id` → Django `GET /api/post/:id`
  - `frontend/src/app/api/post/[id]/route.ts`
- `PATCH /api/post/:id` → Django `PATCH /api/post/:id`
  - `frontend/src/app/api/post/[id]/route.ts`
- `DELETE /api/post/:id` → Django `DELETE /api/post/:id`
  - `frontend/src/app/api/post/[id]/route.ts`
- `GET /api/post/:id/replies` → Django `GET /api/post/:id/replies`
  - `frontend/src/app/api/post/[id]/replies/route.ts`
- `POST /api/post/:id/reply` → Django `POST /api/post/:id/reply`
  - `frontend/src/app/api/post/[id]/reply/route.ts`
- `POST /api/post/:id/like` → Django `POST /api/post/:id/like`
  - `frontend/src/app/api/post/[id]/like/route.ts`
- `DELETE /api/post/:id/like` → Django `DELETE /api/post/:id/like`
  - `frontend/src/app/api/post/[id]/like/route.ts`
- `POST /api/post/:id/echo?side=...` → Django `POST /api/post/:id/echo?side=...`
  - `frontend/src/app/api/post/[id]/echo/route.ts`
- `DELETE /api/post/:id/echo?side=...` → Django `DELETE /api/post/:id/echo?side=...`
  - `frontend/src/app/api/post/[id]/echo/route.ts`
- `POST /api/post/:id/quote` → Django `POST /api/post/:id/quote`
  - `frontend/src/app/api/post/[id]/quote/route.ts`

### 4.2 Proxy core
All these routes use `proxyJson()`:
- forwards cookies (session truth)
- forwards CSRF for unsafe methods
- dev-only: can pass `x-sd-viewer` (where explicitly added)

**Path:** `frontend/src/app/api/auth/_proxy.ts`

---

## 5) Backend API layer (DRF views + store selection)

### 5.1 URLConf
**Path:** `backend/siddes_post/urls.py`

Mounted under `/api/` via the backend API router:
- `POST   /api/post` → `PostCreateView`
- `GET    /api/post/<post_id>` → `PostDetailView.get`
- `PATCH  /api/post/<post_id>` → `PostDetailView.patch`
- `DELETE /api/post/<post_id>` → `PostDetailView.delete`
- `GET    /api/post/<post_id>/replies` → `PostRepliesView.get`
- `POST   /api/post/<post_id>/reply` → `PostReplyCreateView.post`
- `POST   /api/post/<post_id>/like` → `PostLikeView.post`
- `DELETE /api/post/<post_id>/like` → `PostLikeView.delete`
- `POST   /api/post/<post_id>/echo` → `PostEchoView.post`
- `DELETE /api/post/<post_id>/echo` → `PostEchoView.delete`
- `POST   /api/post/<post_id>/quote` → `PostQuoteEchoView.post`

### 5.2 Store selector (DB vs memory)
**Purpose:** Default to DB stores always; allow memory stores only when `DEBUG=True` and `SIDDES_ALLOW_MEMORY_STORES=1`.
- `POST_STORE`, `REPLY_STORE`
- **Path:** `backend/siddes_post/runtime_store.py`

### 5.3 DB store implementations
- **Path:** `backend/siddes_post/store_db.py`
- `DbPostStore.create/get/list` (idempotency via `client_key`)
- `DbReplyStore.create/list_for_post/count_for_post`

---

## 6) Data contracts (request/response schemas)

### 6.1 Feed contract (where posts are first seen)
**Endpoint:** `GET /api/feed?side=<side>&topic=<optional>&limit=<optional>&cursor=<optional>`
- **Backend:** `backend/siddes_feed/views.py` → `list_feed()`
- **Feed builder:** `backend/siddes_feed/feed_stub.py`

**Response (non-restricted):**
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_1",
  "role": "me",
  "side": "friends",
  "count": 30,
  "items": [ <FeedPost-like objects> ],
  "nextCursor": "<created_at>|<id>" | null,
  "hasMore": true|false,
  "serverTs": 1730000000.123
}
```

**Restricted response (no viewer):**
```json
{ "ok": true, "restricted": true, "side": "public", "count": 0, "items": [] }
```

**Feed item shape:** matches `FeedPost` fields (see §1.1), including engagement + echo state and `canEdit/canDelete`.

### 6.2 Create post
**Endpoint:** `POST /api/post` (Next) → `POST /api/post` (Django)

**Request JSON (compose):**
```json
{
  "side": "public|friends|close|work",
  "text": "...",
  "setId": "<set_id>" | null,
  "urgent": true|false,
  "publicChannel": "<topic>" | null,
  "client_key": "ui_...",
  "mediaKeys": ["r2/...", "r2/..."]
}
```

**Response (201):**
```json
{ "ok": true, "status": 201, "post": { ...FeedPost }, "side": "public" }
```

Notable server-side normalization:
- `side` is clamped to allowed sides.
- Circle posts (`setId`) may **force** side to the Circle’s side.
- Broadcast posts use `setId` starting with `b_` and are forced into Public.

**Common error codes:**
- `400 empty_text`
- `400 too_long {max}` (Public 800 chars; non-public 5000)
- `400 too_many_media`
- `400 invalid_media` / `400 media_already_used`
- `401 restricted`
- `403 restricted` / trust-gate failures: `public_trust_low`, `rate_limited`
- broadcast-only: `403 broadcast_write_forbidden`, `503 broadcast_unavailable`

### 6.3 Read post detail
**Endpoint:** `GET /api/post/:id`

**Response (200):**
```json
{ "ok": true, "post": { ...FeedPost }, "side": "friends" }
```

**Not found (404):** returned for both missing posts and denied visibility (fail-closed).

### 6.4 Edit post
**Endpoint:** `PATCH /api/post/:id`

**Request JSON:**
```json
{ "text": "..." }
```

**Response (200):**
```json
{ "ok": true, "post": { ...FeedPost } }
```

**Common errors:**
- `403 edit_window_closed`
- `400 empty_text`
- `400 too_long {max}`
- Public edits are also subject to trust gates.

### 6.5 Delete post
**Endpoint:** `DELETE /api/post/:id`

**Response (200):**
```json
{ "ok": true, "deleted": true, "id": "p_..." }
```

### 6.6 List replies
**Endpoint:** `GET /api/post/:id/replies`

**Response:**
```json
{
  "ok": true,
  "postId": "p_...",
  "count": 2,
  "replies": [
    {
      "id": "r_...",
      "postId": "p_...",
      "authorId": "me_1",
      "author": "...",
      "handle": "@...",
      "text": "...",
      "createdAt": 1730000000123,
      "clientKey": "reply_..."
    }
  ]
}
```

### 6.7 Create reply
**Endpoint:** `POST /api/post/:id/reply`

**Request JSON:**
```json
{ "text": "...", "client_key": "reply_..." }
```

**Response (201):**
```json
{ "ok": true, "status": 201, "reply": { "id": "r_...", "post_id": "p_...", "text": "...", "client_key": "...", "created_at": 1730000000123 } }
```

Reply rules:
- Max length 2000
- Non-public replies require `role == me` (author session)
- Public replies are trust-gated

### 6.8 Like / Unlike
**Endpoint:** `POST /api/post/:id/like` or `DELETE /api/post/:id/like`

**Response:**
```json
{ "ok": true, "liked": true|false, "postId": "p_...", "likeCount": 5 }
```

### 6.9 Echo / Un-echo
**Endpoint:** `POST /api/post/:id/echo?side=<targetSide>` and `DELETE ...`

**Response:**
```json
{ "ok": true, "echoed": true|false, "postId": "p_...", "side": "friends", "echoCount": 2 }
```

Echo rules:
- Only Public originals can be echoed.
- Echo state/count are scoped to the **target side**.
- A “pure echo” is a Post with empty text and a stable `client_key = echo:<post_id>:<side>`.

### 6.10 Quote-echo
**Endpoint:** `POST /api/post/:id/quote`

**Request JSON:**
```json
{ "text": "...", "side": "friends", "client_key": "quote_..." }
```

**Response (201):**
```json
{ "ok": true, "status": 201, "post": { ...FeedPost }, "side": "friends" }
```

Quote-echo rules:
- Only Public originals can be quote-echoed.
- Same length limits + trust gates as regular post creation.

### 6.11 Media attachment payload
When media is attached:
- Composer passes `mediaKeys` (R2 keys) into `POST /api/post`.
- Backend validates keys belong to viewer and are unused.
- Backend returns `post.media` entries:
```json
{ "id": "...", "r2Key": "...", "kind": "image|video", "contentType": "image/png", "url": "/m/<key>?t=<token>" }
```

Backend attachment helpers:
- `backend/siddes_post/views.py` → `_parse_media_keys()`, `_media_for_post()`
- `backend/siddes_media/token_urls.py` → `build_media_url()`

---

## 7) Guardrails (Side safety + server-truth enforcement points)

### 7.1 Side mismatch guard (UI)
- Post detail compares `activeSide` vs `postSide` and shows a banner.
- Entering the post’s side is a deliberate action (`setSide(postSide)`).
- **Path:** `frontend/src/app/siddes-post/[id]/page.tsx`

### 7.2 Server-truth visibility (backend)
Visibility is enforced in views (fail-closed):
- `backend/siddes_post/views.py` → `_can_view_post_record()` + `_set_meta()`
- `backend/siddes_feed/feed_stub.py` → `_can_view_record()` + `_set_allows()`

Key gates:
- Non-public without Circle: author-only
- Circle posts: require membership
- Broadcast posts (`b_*`): public-readable channel semantics
- Block/mute enforcement hooks (when present)
- Hidden moderation gate (`is_hidden`) allows only author/staff

### 7.3 Public trust gates
Public write actions (post, edit, reply, quote) use:
- `backend/siddes_post/trust_gates.py` (via `enforce_public_write_gates()`)

### 7.4 Echo safety rule
Echo/quote-echo are allowed only for **Public originals**:
- `backend/siddes_post/views.py` → `PostEchoView` + `PostQuoteEchoView`

### 7.5 Session truth + dev viewer
- In production, the dev viewer header/cookie is ignored.
- Next proxies always forward session cookies.

---

## 8) Third-party tissue touched by the post pipeline

- **Next.js App Router** (`useRouter`, route handlers) — navigation + same-origin API.
- **@tanstack/react-virtual** — feed virtualization in `SideFeed`.
- **lucide-react** — post actions icons, composer icons.
- **Cloudflare R2 + Worker token URLs** — media attachments (`/api/media/sign-upload`, `/m/*` redirects).
- **Browser share APIs** — `navigator.share`, clipboard.

---

## 9) Complete call-site inventory (frontend files that directly hit `/api/post`)

(14 unique files)
- frontend/src/app/api/post/[id]/echo/route.ts
- frontend/src/app/api/post/[id]/like/route.ts
- frontend/src/app/api/post/[id]/quote/route.ts
- frontend/src/app/api/post/[id]/replies/route.ts
- frontend/src/app/api/post/[id]/reply/route.ts
- frontend/src/app/api/post/[id]/route.ts
- frontend/src/app/api/post/route.ts
- frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx
- frontend/src/app/siddes-compose/client.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/components/EditPostSheet.tsx
- frontend/src/components/PostCard.tsx
- frontend/src/lib/offlineQueue.ts
- frontend/src/lib/postLookup.ts (deprecated)

---

## 10) Suggested next Phase 2 blocks (choose one)
- **Visibility policy** (central rules + enforcement)
- **Circles pipeline** (membership + set-scoped posting + audience wiring)
- **Inbox pipeline** (threads, unread, pagination)
- **Safety pipeline** (blocks/mutes/reports/appeals)
