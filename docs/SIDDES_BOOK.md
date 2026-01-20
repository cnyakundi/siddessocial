# Siddes Book
**Updated:** 2026-01-19

This is the consolidated “one doc” view of Siddes: philosophy, architecture, and the current feature surface.

## 1) What Siddes is
Siddes solves **context collapse** by making social context explicit and enforced:

- **Sides** are persistent contexts (Public/Friends/Close/Work).
- **Sets** are sub-groups inside a Side.
- The server is the source of truth for privacy and authorization.

### Core laws (do not break)
- **Chameleon law: COLOR = MEANING** (blue is Public only).
- **No cross-side leakage**: a bug that leaks across sides is a P0.
- **Server truth > client illusion**: never trust client-provided viewer identity in production.
- **Hide unfinished features** (no “coming soon” in main paths).

## 2) Architecture (high-level)

### Frontend
- Next.js (App Router)
- Browser talks to **same-origin** `/api/*` route handlers (Next)
- Those route handlers proxy to Django (`SD_INTERNAL_API_BASE`)

### Backend
- Django + DRF
- Session-auth is truth (`request.user`)
- Side/Set authz enforced server-side

**Reference:** `ARCHITECTURE.md`, `PRIVACY_SECURITY.md`, `SESSIONS.md`

## 3) How requests flow (the “spider”)

**UI route** → **React component** → **fetch to Next `/api/*`** → **proxy to Django `/api/*`** → **view/viewset** → **store/model**

This pattern is intentional:
- browser never calls Django directly
- cookies stay first-party
- you get one place to enforce headers/logging (`frontend/src/app/api/*`)

## 4) Feature surface (what exists today)

### Posts
- Create, detail, replies, edit/delete
- Like, echo, quote-echo

Docs:
- `POSTS_CREATE_BACKEND.md`
- `POST_DETAIL_BACKEND.md`
- `POST_EDIT_DELETE.md`

### Feed
- Cursor paging + topic filter

Docs:
- `FEED_BACKEND.md`
- `PERFORMANCE_SUPERSONIC.md`

### Sets
- CRUD, membership gating, events

Docs:
- `SETS_BACKEND.md`

### Invites
- create/accept/reject/revoke

### Inbox
- threads + messages + read state

Docs:
- `INBOX_BACKEND_CONTRACT.md`
- `INBOX_DB.md`

### Broadcasts
- follow/unfollow, notify modes, seen/unread, feed + posts

### Safety
- blocks, reports, staff moderation console

### Search
- users + posts

### Telemetry (privacy-safe)
- counts-only suggestion quality events

Docs:
- `ML_PART_8_PRIVACY_SAFE_TELEMETRY.md`

### Media
- backend has signed upload endpoints (R2 plan)
- UI wiring is still landing

Docs:
- `MEDIA_R2.md`

## 5) On-device intelligence (Siddes ML)
Siddes personal context intelligence should run **on-device**:
- contact-derived clustering
- suggest sets/sides
- user accepts/edits/undoes

Docs:
- `ML_PART_0.md`
- `ML_PART_1_ON_DEVICE.md`
- `ML_PART_2_LOCAL_CLUSTERING.md`
- `ML_PART_6_HUMAN_REVIEW.md`
- `ML_PART_7_SIDE_GUARDS.md`

## 6) Deployment gates
The definitive launch checklist is:
- `DEPLOYMENT_GATES.md`

A deployment is “real” only when:
- `DJANGO_DEBUG=0` and secrets/hosts are safe
- no dev-only routes are reachable
- Side/Set authz is enforced server-side
- DB migrations + backups are part of deploy

## 7) Where to look next
- Project status: `STATE.md` and `STATUS_REFRESH_2026_01_19.md`
- Overlay history: `OVERLAYS_INDEX.md` (dev log)
- Testing ladder: `TESTING.md` + `SMOKE_TESTS.md`
