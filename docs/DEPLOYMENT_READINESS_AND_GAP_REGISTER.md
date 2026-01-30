# Siddes — Deployment Readiness & Gap Register

Date: **2026-01-19**

This is the **single document** that captures:
1) what is already *real* (wired end-to-end)
2) what is *missing / not wired / risky*
3) what must be done to go live on:
- **Frontend:** Vercel (Next.js App Router)
- **Backend:** DigitalOcean (Django/DRF)
- **Media:** Cloudflare (R2 storage + Worker delivery)

---

## 1) Current production architecture (how Siddes actually works)

### 1.1 The core request path
Siddes is already set up with the safest pattern for session auth:

**Browser → Next.js same-origin `/api/*` route handlers → Django `/api/*`**

Meaning:
- The browser talks only to the **Vercel domain** (same origin) for API calls.
- Next API route handlers forward **session cookies** to Django.
- Django stays the source of truth for authz.

**Key implementation:** `frontend/src/app/api/auth/_proxy.ts` resolves backend origin.

### 1.2 What this implies for go-live
- On Vercel production, you **must** set a backend origin env var (see GL-001).
- You can keep cookies on the frontend domain, which avoids cross-site cookie pain.

---

## 2) What is already REAL (end-to-end)

These areas are already wired through Next → Django and are DB-backed:

- **Auth + sessions + account lifecycle** (signup/login/verify/reset/change email, session mgmt)
- **Posts** (create, read, edit, delete)
- **Replies** (list + create)
- **Engagement** (like, echo, quote)
- **Feed** (cursor paging)
- **Circles** (create/update/delete, membership, events)
- **Invites** (create/accept/reject/revoke)
- **Inbox** (threads/messages)
- **Broadcasts**
- **Safety** (blocks, reports, moderation staff console)
- **Prism profile + siding**
- **Search**
- **Rituals**
- **Telemetry (counts-only)**

This is a strong foundation. The gaps below are about production hardening + media + wiring edge-cases.

---

## 3) Gap Register (the true remaining issues)

Severity meanings:
- **P0 (Blocker):** do not go live until solved
- **P1 (Launch risk):** can go live, but expect user-facing breakage/confusion or security risk
- **P2 (Debt):** safe to ship but will slow you down

### 3.1 P0 Blockers

#### GL-001 — Vercel production will fail without backend origin env var
- **Status:** Missing config
- **Symptom:** Any Next `/api/*` proxy returns `backend_not_configured`
- **Evidence:** `frontend/src/app/api/auth/_proxy.ts` → production returns `null` unless `SD_INTERNAL_API_BASE` (or `NEXT_PUBLIC_API_BASE`) is set.
- **Fix:** Circle on Vercel Production env:
  - `SD_INTERNAL_API_BASE=https://api.<yourdomain>.com`
- **Acceptance:** `GET https://app.<yourdomain>.com/api/auth/me` returns `{ok:true,...}` (not backend_not_configured).

#### GL-002 — Backend has no production WSGI server dependency
- **Status:** Missing dependency
- **Symptom:** You can’t run safely on DO with `runserver`; you need gunicorn/uvicorn.
- **Evidence:** `backend/requirements.txt` does **not** include gunicorn.
- **Fix:** Add to backend requirements:
  - `gunicorn>=21,<23`
- **Acceptance:** DO run command succeeds and serves `/healthz` and `/api/auth/me`.

#### GL-003 — Media pipeline exists, but is not integrated into posts or the UI
- **Status:** Not wired
- **Symptom:** You cannot attach images/videos to posts in a real way.
- **Evidence:**
  - Backend media endpoints exist: `backend/siddes_media/views.py` + `backend/siddes_media/urls.py`
  - Posts have no attachment model/field: `backend/siddes_post/models.py`
  - No Next proxies for `/api/media/*`: there is **no** `frontend/src/app/api/media/*`
- **Fix:** See **Section 4 (Media Wiring Plan)**.
- **Acceptance:** A user can:
  1) upload an image/video
  2) create a post referencing it
  3) see it in feed + post detail

#### GL-004 — Cloudflare Worker example is public-only; private media would leak if deployed as-is
- **Status:** Security risk
- **Symptom:** If you route `/m/*` to the Worker, anyone can fetch any key.
- **Evidence:** `ops/cloudflare/r2_media_worker/index.js` serves any key without auth.
- **Fix:** Add private-media auth (token or cookie-based) before routing `/m/*` in production.
- **Acceptance:** Private media is inaccessible without a valid token/cookie, while public media is cached.

### 3.2 P1 Launch Risks

#### GL-005 — Contacts “suggestions” returns empty in production (by design)
- **Status:** Intentional restriction, but UX risk
- **Symptom:** Import/Sync contacts appears like a feature but yields nothing.
- **Evidence:** `backend/siddes_contacts/views.py` → `if not settings.DEBUG: return {items: []}`
- **Current mitigation (already applied in cleanup pack):**
  - Feed empty state: in production, it routes users to `/siddes-circles?create=1` instead of import.
  - Evidence: `frontend/src/components/SideFeed.tsx` production branch.
- **Remaining decision:**
  - Either keep contacts import **dev-only** until you ship real phone contact hashing flow.
  - Or implement privacy-safe server suggestion pipeline (bigger).

#### GL-006 — Django staticfiles/admin serving not defined for production
- **Status:** Missing production static serving strategy
- **Symptom:** Django admin may have missing CSS/JS in production.
- **Evidence:** `backend/siddes_backend/settings.py` sets `STATIC_URL` but no `STATIC_ROOT` or whitenoise.
- **Fix options:**
  1) Add **whitenoise** and `STATIC_ROOT` + `collectstatic` step.
  2) Or disable admin in production and rely on API-only.

#### GL-007 — “Hide post” action is client-only (not persisted)
- **Status:** Partially wired
- **Symptom:** Users think they hid a post, but it returns on refresh.
- **Evidence:** UI hide only mutates local state in Post actions; there’s no backend endpoint/store.
- **Fix:** Add server endpoint + per-viewer hidden table, or remove action until real.

### 3.3 P2 Debt / Cleanliness

#### GL-008 — Docs/config drift around store selection
- **Status:** Documentation drift
- **Symptom:** Env vars like `SD_INBOX_STORE` are referenced historically but behavior now defaults DB.
- **Fix:** Update docs to reflect current selection rules.

#### GL-009 — Test coverage is thin outside Posts/Circles
- **Status:** Quality debt
- **Fix:** Minimal smoke tests for: auth/session, inbox, invites, broadcasts, safety.

#### GL-010 — Repo hygiene (backups/build artifacts)
- **Status:** Already fixed by cleanup pack
- **Evidence:** `.backup_*`, `.next_build`, `.bak*` were removed.

---

## 4) Media pipeline — wiring plan (Cloudflare R2 + secure delivery)

### 4.1 What you already have (backend)
Backend supports Cloudflare **R2** presigned PUT/GET:
- `POST /api/media/sign-upload` → returns presigned **PUT** URL
- `POST /api/media/commit` → marks object committed + can mark public
- `GET /api/media/url?key=...` → returns short-lived presigned **GET** URL

Evidence: `backend/siddes_media/views.py` and `backend/siddes_backend/urls.py` (`/m/<key>` redirect view exists).

### 4.2 What is missing (frontend + post integration)
To make “media posts” real, you must implement:

1) **Next API proxies** for media endpoints
- Add:
  - `frontend/src/app/api/media/sign-upload/route.ts`
  - `frontend/src/app/api/media/commit/route.ts`
  - `frontend/src/app/api/media/url/route.ts`

2) **Data model + API contract for post attachments**
Choose one:
- **Option A (recommended):** New table `PostMedia` linking `post_id` ↔ `media_id / r2_key`
- **Option B:** JSON field on `Post` with attachments list

Minimum attachment fields:
- `id` (media_id)
- `r2Key`
- `kind` (image|video)
- `contentType`
- `bytes`
- `isPublic`
- `url` (delivery URL)

3) **Post create flow that commits media server-side**
Target behavior:
- Client uploads file to R2 via presigned PUT.
- Client creates post with `attachments=[{r2Key, id, ...}]`.
- Server validates ownership + visibility, then:
  - links attachments to post
  - flips `MediaObject.status=committed`
  - sets `is_public` if the post is public

4) **Feed + post detail include attachments**
So the UI can render them.

### 4.3 Secure delivery (Cloudflare Worker) — recommended target state

**Why Worker:**
- stable URLs like `https://media.<domain>/m/<key>`
- CDN caching for public media
- range requests for video

You already have an example Worker:
- `ops/cloudflare/r2_media_worker/index.js`

**BUT:** as written it’s public-only. To ship Sides safely:

#### Public media strategy
- Allow long cache headers (`max-age=31536000, immutable`).
- This is okay for **Public-side** posts and explicitly public profile assets.

#### Private media strategy (for Friends/Close/Work)
You need an auth mechanism.

**Recommended:** signed query token
- Backend returns a URL like:
  - `https://media.<domain>/m/<key>?t=<token>`
- Worker verifies token (HMAC) with secret `MEDIA_TOKEN_SECRET`.
- Token contains: `key`, `viewer_id`, `exp`.
- Worker only serves if token valid and not expired.
- For private media:
  - `cache-control: private, no-store` (or very short TTL)

This approach:
- works cross-domain
- avoids relying on cookies on the media domain
- prevents accidental public exposure

### 4.4 Suggested phased rollout

**Phase 0 (fastest, safe):**
- Ship media only for **Public-side** posts.
- Mark those objects `is_public=true`.
- Worker can serve them with long cache.

**Phase 1 (full Siddes):**
- Add signed-token private media support.
- Allow media attachments on Friends/Close/Work.

### 4.5 Acceptance tests (media)

1) **Upload**
- `POST /api/media/sign-upload` returns PUT url
- PUT succeeds with correct content-type

2) **Post create**
- `POST /api/post` with attachments commits media and returns attachment URLs

3) **Feed render**
- Feed item includes attachments array
- UI renders image/video

4) **Privacy**
- Private media cannot be loaded without valid token

---

## 5) Go-live infrastructure plan (DigitalOcean + Vercel + Cloudflare)

### 5.1 Recommended domains
- `app.<domain>` → Vercel (Next.js)
- `api.<domain>` → DigitalOcean (Django)
- `media.<domain>` → Cloudflare Worker (R2)

### 5.2 Vercel required config
**Environment variables (Production):**
- `SD_INTERNAL_API_BASE=https://api.<domain>`  ← critical (GL-001)

(Optional, depending on your config):
- `NEXT_PUBLIC_SITE_URL=https://app.<domain>` (if you use it later)

### 5.3 DigitalOcean required config (Django)
**Environment variables (Production):**
- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<strong secret, >=32 chars>`
- `DJANGO_ALLOWED_HOSTS=api.<domain>` (no wildcard)
- `DJANGO_CSRF_TRUSTED=https://app.<domain>,https://<domain>`
- `DATABASE_URL=postgres://...` (use DO managed Postgres)
- `SIDDES_CONTACTS_PEPPER=<strong secret, >=32 chars>`

Email (choose one):
- SMTP:
  - `SD_EMAIL_PROVIDER=smtp`
  - `SD_EMAIL_FROM=no-reply@<domain>`
  - `SD_SMTP_HOST=...`
  - `SD_SMTP_USER=...`
  - `SD_SMTP_PASSWORD=...`
- Or SendGrid:
  - `SD_EMAIL_PROVIDER=sendgrid`
  - `SD_SENDGRID_API_KEY=...`

R2 (storage):
- `SIDDES_R2_ACCOUNT_ID=...` (or `SIDDES_R2_ENDPOINT=...`)
- `SIDDES_R2_BUCKET=siddes-media`
- `SIDDES_R2_ACCESS_KEY_ID=...`
- `SIDDES_R2_SECRET_ACCESS_KEY=...`

### 5.4 DigitalOcean run strategy
**Minimum:** run Django behind gunicorn.

Suggested run command (App Platform style):
- `gunicorn siddes_backend.wsgi:application --bind 0.0.0.0:$PORT --worker-tmp-dir /dev/shm`

### 5.5 Cloudflare (R2 + Worker)
- Create R2 bucket (e.g. `siddes-media`).
- Deploy Worker (start from `ops/cloudflare/r2_media_worker`).
- Bind bucket to Worker as `MEDIA_BUCKET`.
- Route `media.<domain>/m/*` (or `<domain>/m/*`) to Worker.

**Do not ship private media via Worker until you implement auth** (GL-004).

---

## 6) Launch checklist (do these in order)

### 6.1 Code/config preflight
- [ ] Backend: add `gunicorn` to requirements (GL-002)
- [ ] Vercel: set `SD_INTERNAL_API_BASE` (GL-001)
- [ ] Ensure `DJANGO_DEBUG=0` guardrails pass (SECRET_KEY, ALLOWED_HOSTS, CONTACTS_PEPPER)

### 6.2 Media readiness
- [ ] Implement Next `/api/media/*` proxies
- [ ] Implement post attachments model + API contract
- [ ] Render attachments in feed + post detail
- [ ] Decide Phase 0 vs Phase 1 for private media

### 6.3 Infrastructure
- [ ] DO managed Postgres + migrate
- [ ] (Optional) DO Redis for cache/throttling
- [ ] Cloudflare R2 bucket + access keys
- [ ] Cloudflare Worker deployed + route set

### 6.4 Smoke tests (manual)
- [ ] Signup → verify email → login
- [ ] Create post in each Side
- [ ] Like/echo/quote/reply
- [ ] Create set + invite + accept
- [ ] Inbox send message
- [ ] Block/report + confirm restricted behavior

---

## 7) Notes on what we intentionally keep OFF for launch
- **Server contacts suggestions in production** (privacy-safe default)
- **Dev-only routes** (`/launchpad`, `/developer`) should 404 in production builds

---

## 8) Next step
If you want, the next “go-live brick” is:
1) Implement media wiring (Section 4) end-to-end
2) Add a DigitalOcean production pack (gunicorn + optional whitenoise + deploy commands)
