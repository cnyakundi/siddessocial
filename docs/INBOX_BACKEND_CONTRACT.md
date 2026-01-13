# Inbox backend contract (real backend target)
**Updated:** 2026-01-10

This doc defines the **stable contract** between the Siddes Inbox UI (`InboxProvider`) and the backend.

Today the app ships a **backend_stub** implementation using Next.js route handlers. This contract is written so we can replace the stub with a **real Django backend** without rewriting the UI.

Quickstart (store modes + seeding): see `docs/INBOX_DB.md`.


Where to look in code:
- Provider interface: `frontend/src/lib/inboxProvider.ts`
- Current stub provider: `frontend/src/lib/inboxProviders/backendStub.ts`
- Stub API routes:
  - `frontend/src/app/api/inbox/threads/route.ts`
  - `frontend/src/app/api/inbox/thread/[id]/route.ts`

---

## Contract principles
1) **Locked Side is the truth.** Every thread is locked to exactly one Side (`lockedSide`).
2) **Default-safe.** If access is denied, respond with `restricted: true` and **no content**.
3) **Stable shapes.** The UI expects consistent JSON fields; backends may add fields, but should not remove/rename core ones.
4) **Pagination is cursor-based.** Cursors are **opaque to clients**.

---

## Provider → endpoint map

| Provider method | HTTP | Path | Notes |
|---|---|---|---|
| `listThreads(opts)` | GET | `/api/inbox/threads` | Cursor pagination + optional Side filter |
| `getThread(id, opts)` | GET | `/api/inbox/thread/:id` | Messages pagination (“Load earlier”) |
| `sendMessage(id, text, from, opts)` | POST | `/api/inbox/thread/:id` | Creates message + bumps `updatedAt` |
| `setLockedSide(id, side, opts)` | POST | `/api/inbox/thread/:id` | Body `{ setLockedSide: side }` |

Notes:
- In **backend_stub** we accept viewer identity via cookie/header for dev tooling (`sd_viewer` / `x-sd-viewer`).
- The legacy `viewer` query param is **deprecated** and should be ignored.
- In the **real backend** the viewer comes from auth (session/JWT). `viewer` should be ignored unless explicitly enabled in a dev-only mode.

---

## Shared types

### `SideId`
One of:
- `public`
- `friends`
- `close`
- `work`

### `Participant`
Required for the polished Inbox UI.

```json
{
  "displayName": "Marcus",
  "initials": "MM",
  "avatarSeed": "seed_4a9f0c2b"
}
```

### `ThreadItem`
Returned in `listThreads()`.

```json
{
  "id": "t_work_1",
  "title": "Work Group",
  "participant": { "displayName": "Work Group", "initials": "WG", "avatarSeed": "seed_..." },
  "lockedSide": "work",
  "last": "Updated the roadmap slides…",
  "time": "10m",
  "unread": 2,
  "updatedAt": 1704872330123
}
```

Field notes:
- `time` is a **relative label** (e.g. `2m`, `1h`, `3d`). It’s OK for the real backend to send `""` and let the UI derive time from `updatedAt`, but keeping it populated preserves parity with the stub.
- `updatedAt` is **milliseconds since epoch**.

### `ThreadMeta`

```json
{
  "lockedSide": "friends",
  "updatedAt": 1704872330123
}
```

### `ThreadMessage`

```json
{
  "id": "m_k3j9...",
  "ts": 1704872330123,
  "from": "me",
  "text": "Hey — are we still on for Saturday?",
  "side": "friends",
  "queued": false
}
```

---

## 1) List threads

### Request
`GET /api/inbox/threads`

Query params:
- `side` (optional): filter to one `SideId`
- `limit` (optional): default `20`, max `50`
- `cursor` (optional): opaque cursor from previous response

Stub-only debug inputs (optional):
- cookie `sd_viewer` OR header `x-sd-viewer` (legacy `viewer` query param is deprecated/ignored)

### Success response
```json
{
  "ok": true,
  "restricted": false,
  "items": [/* ThreadItem[] */],
  "hasMore": true,
  "nextCursor": "1704872330123:t_work_1"
}
```

### Restricted response
```json
{
  "ok": true,
  "restricted": true,
  "items": [],
  "hasMore": false,
  "nextCursor": null
}
```

### Ordering + cursor semantics
- Order threads by `updatedAt DESC, id DESC`.
- `cursor` means: **return items strictly after this cursor** in that ordering.

Cursor format:
- Stub uses `"<updatedAt>:<id>"`.
- Real backend may use any opaque encoding, but must treat it as opaque to clients.

Unread semantics:
- `unread` is the viewer’s unread count for the thread.

---

## 2) Get thread (with messages)

### Request
`GET /api/inbox/thread/:id`

Query params:
- `limit` (optional): default `30`, max `100` (messages)
- `cursor` (optional): messages cursor for fetching older messages

### Success response
```json
{
  "ok": true,
  "restricted": false,
  "thread": { /* ThreadItem (lockedSide required) */ },
  "meta": { /* ThreadMeta */ },
  "messages": [/* ThreadMessage[] */],
  "messagesHasMore": true,
  "messagesNextCursor": "1704872000000:m_abc123"
}
```

### Restricted response
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

### Messages pagination rules
- Store messages in ascending time order.
- For page fetch:
  - if `cursor` is provided, treat it as **“fetch messages older than cursor”**.
  - return the **last N** eligible messages (so the user sees the newest messages first, with a “Load earlier” button).
- `messagesNextCursor` should reference the **oldest message in the returned page**.

Cursor format:
- Stub uses `"<ts>:<id>"`.
- Real backend may use any opaque encoding.

Read semantics:
- A successful `getThread()` should clear unread for the caller/viewer for that thread.

---

## 3) Send message

### Request
`POST /api/inbox/thread/:id`

Body:
```json
{ "text": "hello", "from": "me" }
```

Notes:
- In the real backend, `from` is implicitly the authenticated user. The server may ignore/override it.

### Success response
```json
{
  "ok": true,
  "restricted": false,
  "message": { /* ThreadMessage */ },
  "meta": { /* ThreadMeta */ }
}
```

### Restricted response
```json
{ "ok": true, "restricted": true, "message": null, "meta": null }
```

### Error response
If `text` is missing/blank:
- HTTP `400`
```json
{ "ok": false, "error": "missing_text" }
```

Unread semantics:
- Sending a message should increment unread counts for other participants (implementation-specific), and update `updatedAt`.

---

## 4) Set locked side (move thread)

### Request
`POST /api/inbox/thread/:id`

Body:
```json
{ "setLockedSide": "close" }
```

### Response
```json
{
  "ok": true,
  "restricted": false,
  "meta": { "lockedSide": "close", "updatedAt": 1704872330123 }
}
```

Rules:
- Validate `setLockedSide` is a `SideId`.
- Enforce viewer is allowed to move the thread into that Side.
- If denied, return `restricted: true` and `meta: null`.

---

## Django mapping plan (v0)

Target: implement the above endpoints in Django while keeping the frontend provider contract unchanged.

Suggested minimal model sketch:
- `InboxThread`
  - `id` (uuid or short id)
  - `locked_side` (`public|friends|close|work`)
  - `updated_at` (auto bump on new message / move)
- `InboxMessage`
  - `thread` (FK)
  - `ts` (auto_now_add)
  - `from_user` (FK nullable for stub/demo)
  - `text`
  - `side` (copy of thread.locked_side at send time)
- `InboxThreadParticipant`
  - `thread` (FK)
  - `user` (FK)
  - `unread_count`

Enforcement:
- Use `backend/siddes_visibility/policy.py` (or the eventual successor) to enforce Side access.
- Keep the “restricted payload” behavior until we decide to move to strict HTTP 403s.

