# Phase 2 Spider Pack — Notifications (Alerts)

This pack is the **structural map** of Siddes notifications (called **Alerts** in some UI surfaces) across:

- **Frontend UI surfaces** (Inbox Alerts tab, Butler Tray, navigation entrypoints)
- **Next.js API proxy layer** (`/api/notifications/*`)
- **Django/DRF endpoints** (`/api/notifications`, `/api/notifications/mark-all-read`)
- **Notification producers** (reply/like/echo + demo seeding)

---

## 0) Source-of-truth files

### Frontend (UI)
- `frontend/src/components/NotificationsView.tsx` — **notifications list renderer** (supports embedded mode).
- `frontend/src/app/siddes-inbox/page.tsx` — hosts the **Alerts** tab: `<NotificationsView embedded />`.
- `frontend/src/app/siddes-notifications/page.tsx` — route exists but **redirects** to `/siddes-inbox?tab=alerts`.
- `frontend/src/components/DesktopButlerTray.tsx` — embeds `NotificationsView` inside the desktop tray Alerts tab.

Navigation entrypoints (links/labels pointing to Alerts):
- `frontend/src/components/AppTopBar.tsx` — bell icon link → `/siddes-notifications`.
- `frontend/src/components/BottomNav.tsx` — treats `/siddes-notifications` as part of “Inbox”.
- `frontend/src/components/DesktopSideRail.tsx` — rail item “Alerts” → `/siddes-notifications`.
- `frontend/src/components/DesktopTopBar.tsx` — title mapping for `/siddes-notifications`.
- `frontend/src/components/TopNav.tsx` — “Notifs” link → `/siddes-notifications`.
- `frontend/src/app/siddes-profile/account/page.tsx` — link → `/siddes-inbox?tab=alerts`.

### Frontend (Next API proxy layer)
- `frontend/src/app/api/notifications/route.ts` — `GET /api/notifications` → proxy to backend `/api/notifications`.
- `frontend/src/app/api/notifications/mark-all-read/route.ts` — `POST /api/notifications/mark-all-read` → proxy to backend `/api/notifications/mark-all-read`.

Shared proxy + CSRF plumbing that these routes rely on:
- `frontend/src/app/api/auth/_proxy.ts` — `proxyJson()` cookie-forwarding + `x-csrftoken` passthrough.
- `frontend/src/lib/csrf.ts` — `patchFetchForCsrf()` patches `window.fetch` to add `x-csrftoken` for unsafe `/api/*` requests.
- `frontend/src/components/AuthBootstrap.tsx` — calls `patchFetchForCsrf()` early in app bootstrap.

### Backend (DRF)
- `backend/siddes_notifications/models.py` — `Notification` DB model.
- `backend/siddes_notifications/service.py` — `notify()` helper (deterministic upsert; never breaks main action).
- `backend/siddes_notifications/views.py` — list + mark-all-read endpoints.
- `backend/siddes_notifications/urls.py` — URL map:
  - `/api/notifications`
  - `/api/notifications/mark-all-read`
- `backend/siddes_backend/api.py` — includes `siddes_notifications.urls` under `/api/`.

Demo / ops:
- `backend/siddes_notifications/management/commands/seed_notifications_demo.py` — seeds deterministic demo alerts.

---

## 1) UI entrypoints + interaction map

### Primary surface (mobile + desktop)
1) User opens **Inbox** → selects **Alerts** tab.
   - Route: `/siddes-inbox?tab=alerts`
   - Host: `frontend/src/app/siddes-inbox/page.tsx`
   - Renderer: `frontend/src/components/NotificationsView.tsx` (embedded)

### Secondary surfaces
- `/siddes-notifications` is a *navigation target* (top bar, rails, etc.), but immediately redirects to the Inbox Alerts tab.
  - `frontend/src/app/siddes-notifications/page.tsx`
- Desktop Butler Tray includes alerts:
  - `frontend/src/components/DesktopButlerTray.tsx` → `<NotificationsView embedded />`

### Click-through path
- A notification row is a `<button>` that pushes:
  - `router.push(/siddes-post/<postId>)`
  - File: `frontend/src/components/NotificationsView.tsx`
- Post visibility is not decided by the notifications system.
  - The destination route `/siddes-post/[id]` + backend post detail enforce privacy/visibility.

---

## 2) Atomic building block — `NotificationsView`

**File:** `frontend/src/components/NotificationsView.tsx`

### Purpose
Fetches viewer-scoped notifications from `/api/notifications`, renders them in grouped sections (Today/Earlier), and allows “Mark all read”.

### Props
- `embedded?: boolean` — if true, renders without outer padding wrapper.

### State dependencies / hooks
- `useSide()` — for Chameleon theme tokens (`SIDE_THEMES[side]`) and label (`SIDES[side]`).
- `useRouter()` — navigation to post detail.
- React hooks: `useState`, `useEffect`, `useMemo`.
- Toast: `toast()` from `frontend/src/lib/toast`.

### Client-side data handling
- On mount:
  - `fetch('/api/notifications', { cache: 'no-store' })`
  - If HTTP !ok: show error (fail-loud; does not pretend “All caught up”).
  - If JSON `{ restricted: true }`: show “Sign in to see alerts”.
  - Else `itemsRaw = j.items || []`.

- Dedupe strategy:
  - `dedupe(items)` keeps the latest per `(actor + type + postId)` and sorts newest-first.

- “Mark all read”:
  - `fetch('/api/notifications/mark-all-read', { method: 'POST' })`
  - If ok: locally sets each `read: true`.

---

## 3) API Layer

### Next.js API endpoints (same-origin)
- `GET /api/notifications`
  - Handler: `frontend/src/app/api/notifications/route.ts`
  - Backend target: `GET /api/notifications`

- `POST /api/notifications/mark-all-read`
  - Handler: `frontend/src/app/api/notifications/mark-all-read/route.ts`
  - Backend target: `POST /api/notifications/mark-all-read`

### Proxy mechanics (shared)
`proxyJson()` (`frontend/src/app/api/auth/_proxy.ts`) forwards:
- `cookie` (session + csrftoken cookie)
- `x-sd-viewer` (dev-only)
- `x-csrftoken` (if present)
- `origin`, `referer`
- `x-request-id`

### CSRF wiring
- `AuthBootstrap` calls `patchFetchForCsrf()`.
- Patched fetch ensures csrftoken cookie exists via `GET /api/auth/csrf` if missing, then adds `x-csrftoken` for unsafe `/api/*` requests.

---

## 4) Data contracts

### NotificationItem (frontend contract)
As rendered by `NotificationsView`:

```ts
type NotifType = "reply" | "like" | "mention" | "echo";

type NotificationItem = {
  id: string;
  actor: string;
  type: NotifType;
  ts: number;          // epoch ms
  glimpse: string;
  postId?: string | null;
  postTitle?: string | null;
  read?: boolean;
};
```

### GET `/api/notifications` — response shapes
Success (viewer present):
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_123",
  "role": "me",
  "count": 12,
  "items": [
    {
      "id": "n_abcdef0123456789",
      "actor": "@elena",
      "type": "like",
      "ts": 1730000000000,
      "glimpse": "…",
      "postId": "p_...",
      "postTitle": "…",
      "read": false
    }
  ]
}
```

Restricted (no viewer):
- HTTP 200 (intentionally not a 401)
```json
{ "ok": true, "restricted": true, "viewer": null, "role": "anon", "count": 0, "items": [] }
```

### POST `/api/notifications/mark-all-read` — response shapes
Success:
```json
{ "ok": true, "viewer": "me_123", "role": "me", "marked": 7 }
```
Restricted:
- HTTP 401
```json
{ "ok": false, "restricted": true, "error": "restricted" }
```

---

## 5) Storage model (DB)

### Model
**File:** `backend/siddes_notifications/models.py`

- `id` (PK, `CharField(64)`)
- `viewer_id` (indexed)
- `type` (indexed; string up to 16)
- `actor` (string)
- `glimpse` (text)
- `post_id` (nullable, indexed)
- `post_title` (nullable)
- `created_at` (float seconds, indexed)
- `read_at` (float seconds, nullable)

Composite index:
- `(viewer_id, -created_at)` for fast “latest for viewer”.

### Deterministic upsert behavior
**File:** `backend/siddes_notifications/service.py`
- `notify(viewer_id, ntype, actor_id, glimpse, post_id, post_title)`:
  - Computes deterministic id via SHA1 of `(viewer_id|type|actor|post_id)`
  - `update_or_create()` (one active row per tuple)
  - Refreshes `created_at` and resets `read_at` to `None` (re-notifies)
  - Truncates `post_title` (80) and `glimpse` (220)
  - Never raises outward (swallows errors) so notifications can’t break core actions.

---

## 6) Producers (where notifications are created)

### Post pipeline emits notifications (explicit calls; no signals)
All of these call `from siddes_notifications.service import notify`:

- **Reply → notify post author**
  - Source: `backend/siddes_post/views.py` (reply endpoint, tag `sd_310_notify_reply`)
  - Type: `reply`
  - Viewer: original `author_id`
  - Actor: replying viewer

- **Like → notify post author**
  - Source: `backend/siddes_post/views.py` (`PostLikeView`, tag `sd_310_notify_like`)
  - Type: `like`

- **Echo / Quote-echo → notify original author**
  - Source: `backend/siddes_post/views.py` (`PostEchoView` + quote-echo path, tags `sd_310_notify_echo`, `sd_310_notify_quote`)
  - Type: `echo`

### Demo seed producer
- `python manage.py seed_notifications_demo [--reset] [--viewer auto|me_123|...]`
  - Source: `backend/siddes_notifications/management/commands/seed_notifications_demo.py`
  - Seeds `reply`, `like`, `mention` (and another like) rows for deterministic UI.

### Notes on “mention” notifications
- The data contract supports `mention` (frontend union + seed command),
- but **automatic mention extraction from post text is not wired yet** (no `ntype="mention"` calls in codebase today).

---

## 7) Guardrails & enforcement touchpoints

### Viewer identity resolution (prod vs dev)
**File:** `backend/siddes_notifications/views.py`
- If request has authenticated Django session user:
  - viewer id becomes `me_<user.id>`.
- If **not** authenticated:
  - If `DEBUG=False` → viewer is absent → list returns `{ restricted: true }`.
  - If `DEBUG=True` → accepts `x-sd-viewer` header or `sd_viewer` cookie.

Role labeling (informational):
- `resolve_viewer_role()` from `backend/siddes_inbox/visibility_stub.py`.

### Mute integration
**File:** `backend/siddes_notifications/views.py`
- Best-effort import: `from siddes_safety.policy import is_muted`.
- If available, notifications whose `actor` is muted by viewer are filtered out.

### Click-through privacy enforcement
Notifications only contain `postId` links. Actual access control happens downstream:
- Post detail + replies endpoints enforce visibility (see Visibility Spider Pack).

---

## 8) Third-party tissue

### Frontend
- `lucide-react` — icons: `AtSign`, `Heart`, `MessageCircle`, `Repeat`.
- Next.js App Router — `useRouter()` navigation.
- TailwindCSS — styling, with Side-aware tokens via `SIDE_THEMES[side]`.

### Backend
- Django ORM — `Notification.objects.filter(...)`.
- DRF `APIView` + `Response`.

---

## 9) Quick file map (copy/paste paths)

Frontend:
- `frontend/src/components/NotificationsView.tsx`
- `frontend/src/app/siddes-inbox/page.tsx`
- `frontend/src/app/siddes-notifications/page.tsx`
- `frontend/src/components/DesktopButlerTray.tsx`
- `frontend/src/app/api/notifications/route.ts`
- `frontend/src/app/api/notifications/mark-all-read/route.ts`
- `frontend/src/app/api/auth/_proxy.ts`
- `frontend/src/lib/csrf.ts`
- `frontend/src/components/AuthBootstrap.tsx`

Backend:
- `backend/siddes_notifications/models.py`
- `backend/siddes_notifications/service.py`
- `backend/siddes_notifications/views.py`
- `backend/siddes_notifications/urls.py`
- `backend/siddes_notifications/management/commands/seed_notifications_demo.py`
- `backend/siddes_backend/api.py`
