# Siddes Media Engine — Hardening Fix Pack (R2 + Worker + Upload UX)
**Role:** Principal Media Pipeline Architect + Security-minded Full-Stack Engineer  
**Constraint:** **No code changes in this doc.** All changes are listed as **TODOs with file paths only**.

---

## Repo references consulted (per requirement)
- `docs/MEDIA_R2.md`
- `docs/CLOUDFLARE_MEDIA_WORKER_TOKEN_GATE.md`
- `backend/siddes_media/*`
- `backend/siddes_post/views.py`
- `backend/siddes_prism/views.py`
- `frontend/src/lib/mediaClient.ts`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/components/PostCard.tsx`
- `frontend/src/components/PrismProfile.tsx`
- `frontend/src/app/m/[...key]/route.ts`
- `frontend/public/sw.js`
- R2 CORS templates:
  - `.tmp_sd_503_cloudflare_r2_cors_autopilot_20260123_092234/cors_aws.json`
  - `.tmp_sd_503_cloudflare_r2_cors_autopilot_20260123_092234/cors_dashboard.json`
  - `.tmp_sd_504_cloudflare_r2_cors_cfapi_autolink_20260123_094445/*`
- Worker:
  - `ops/cloudflare/r2_media_worker/index.js`

---

## Executive Summary (fix order)
### P0 blockers / footguns (fix these first)
1) **Missing Next BFF routes** for media upload/commit:  
   Frontend calls `/api/media/sign-upload` and `/api/media/commit`, but `frontend/src/app/api/media/*` **does not exist** → upload will 404 at step 1.
2) **Service worker caches same-origin images**, including `/m/*` → it can **persist private media** and defeat token expiry.
3) **Sign-upload accepts arbitrary content types** → risk of serving dangerous types same-origin via `/m/*` unless blocked in backend/worker.
4) **Public media revocation isn’t real** on delete: post delete detaches DB rows but **bytes remain in R2**, and public tokens are stable.

This Fix Pack addresses those in Parts 1–5, with acceptance tests and an execution plan.

---

# Part 0 — System Map + Contracts

## 0.1 Media Surface Map (where media is used)
### Avatars (Prism / Side-aware identity)
- Upload UX: `frontend/src/components/PrismProfile.tsx` (uses `signUpload` → `PUT` → `commitUpload` with `postId="prism_avatar:<side>"`)
- Serve URL: `backend/siddes_prism/views.py` generates `/m/<key>?t=<token>` via `build_media_url(...)`
- Render: `frontend/src/components/PostCard.tsx` avatar `<img src=...>`

### Post attachments (images + videos)
- Upload UX: `frontend/src/app/siddes-compose/client.tsx` (direct PUT to R2 using presigned URL)
- Attach surface: `backend/siddes_post/views.py` commits + attaches MediaObject rows during post creation
- Render (feed + detail): `backend/siddes_post/views.py` includes `post.media[]` with `/m/<key>?t=<token>`; frontend renders in `frontend/src/components/PostCard.tsx` (grid + modal)

### Viewer / “Gallery”
- Modal viewer is in `frontend/src/components/PostCard.tsx` (`MediaViewerModal`)

### Same-origin `/m/*` in dev
- Next route: `frontend/src/app/m/[...key]/route.ts` calls backend `GET /api/media/url?key=...` and redirects (302) to a short-lived R2 GET presign.

### Production `/m/*`
- Cloudflare Worker: `ops/cloudflare/r2_media_worker/index.js` verifies `?t=` token then serves from R2.

---

## 0.2 Pipeline Diagram (client → sign-upload → upload → commit → serve)
### Upload (always)
1. Client → `POST /api/media/sign-upload`  
2. Backend returns `{ r2Key, presigned PUT url, headers }`  
3. Client → `PUT presigned_url` directly to R2  
4. Commit:
   - Posts: committed server-side during `POST /api/post`
   - Prism avatar: client calls `POST /api/media/commit`

### Serve
- DEV: browser hits `/m/<key>` → Next route redirects to R2 short-lived signed GET
- PROD: browser hits `/m/<key>?t=<token>` → Worker verifies token → streams from R2 (Range supported)

---

## 0.3 Failure Modes (Top 20)
1) `/api/media/sign-upload` 404 (missing Next BFF route)  
2) R2 CORS preflight fails on PUT  
3) Backend `r2_not_configured` (missing `SIDDES_R2_*`)  
4) Worker `worker_not_configured` (missing secret/binding)  
5) Secret mismatch (`SIDDES_MEDIA_TOKEN_SECRET` ≠ Worker `MEDIA_TOKEN_SECRET`) → 401 spikes  
6) Private tokens expire mid-scroll → broken images/videos  
7) Public media remains reachable after delete (R2 bytes never deleted)  
8) Dangerous content-types (HTML/SVG) served same-origin without nosniff  
9) Wrong content-type breaks Safari video playback  
10) Large video uploads fail on mobile Safari / poor networks  
11) Upload succeeded but post shows broken media (no HEAD/exists verification)  
12) Orphaned pending uploads (abandoned)  
13) Media key reuse/replay edge cases  
14) Video seeking fails if Range handling incomplete  
15) Edge caching accidentally caches private responses  
16) Dev presigned GET expires too quickly on slow networks  
17) CSP blocks R2 endpoints (if used directly anywhere)  
18) Clock skew impacts expiry checks  
19) Tokens leak into logs/analytics/referer  
20) Mixed routing (some `/m/*` hits Worker, some hits Next/backend) creates inconsistent behavior

---

## 0.4 Security Contract (who can view what)
**Core model:** Worker is **capability URL** enforcement; Django must only mint tokens for authorized viewers.

### View rules
- **Public media**: world-readable *via stable pub token*; safe to cache hard.
- **Private post media**: viewer must be allowed to view the post (Side + Circle membership + block checks). Token short-lived.
- **Private Prism avatar**: viewer must be allowed to see that facet (Side membership). Token short-lived.

### Token expectations
- Public token: `{k, m:"pub"}` (stable)
- Private token: `{k, m:"priv", e:<expiry>}` (short-lived, TTL controlled by env)

### Audit expectations
- No full tokens in logs.
- Emit lifecycle events: sign-upload issued, commit attached, serve denied (by reason), not found, etc.

---

## 0.5 Performance Plan (caching + perceived speed)
- Serve all media same-origin at `/m/*` for PWA speed (per `docs/MEDIA_R2.md`)
- Public: long cache, immutable keys
- Private: `no-store` everywhere + SW must not cache it
- UX:
  - aspect-ratio placeholders to prevent layout shift
  - skeletons + retries
  - token refresh flow for expired private media
- Optional later: thumbnails/derived assets for feed tiles

---

# Parts 1–5 — Plan, Tests, Observability, Smoke Tests, TODOs

---

## Part 1 — Upload & Commit Correctness

### Acceptance criteria (exact tests)
**Playwright**
- `frontend/tests/e2e/media_config.spec.ts` no longer skips due to missing routes
- New E2E: attach image → post → feed renders image from `/m/*`
- New E2E: attach video → post → modal plays + loads metadata

**Backend**
- `backend/siddes_media/tests.py` additions:
  - reject invalid content-type by kind
  - reject oversize `bytes`
  - commit idempotent; prevent repointing to different postId
- Post create tests:
  - invalid_media, media_already_used, too_many_media

### Observability events needed
Backend logs:
- `media.sign_upload.issued|rejected`
- `media.commit.ok|fail`
- `post.media.attach.ok|fail`

### Manual smoke tests
- Desktop: upload 3 images + 1 video → post → open modal → navigate
- iOS Safari: upload video → preview → post → play

### TODO file-path list (implementation only)
**Frontend**
- **NEW** `frontend/src/app/api/media/sign-upload/route.ts`
- **NEW** `frontend/src/app/api/media/commit/route.ts`
- (Optional) **NEW** `frontend/src/app/api/media/url/route.ts`

**Backend**
- `backend/siddes_media/views.py` (content-type allowlist, size limits, key hygiene)
- `backend/siddes_post/views.py` (replace silent `except: pass` around media commit with explicit failure)

**Tests**
- `frontend/tests/e2e/*` (add media happy paths)
- `backend/siddes_media/tests.py`

---

## Part 2 — Viewer Permissions & Worker Token Gate

### Acceptance criteria (exact tests)
Worker:
- `/m/<key>?t=<pub>` → 200 + `cache-control: public, max-age=31536000, immutable`
- `/m/<key>?t=<priv>` → 200 + `cache-control: private, no-store`
- missing token → 401 restricted
- expired private token → 401 expired
- Range request → 206 + `Content-Range`

App permissions:
- private post media loads for authorized viewer, denied for unauthorized
- prism avatar private sides load only for members

### Observability events needed
Worker:
- `media.worker.deny` reason buckets
- `media.worker.not_found`, `media.worker.range_206`

Backend:
- `media.url.issued|denied` decision path buckets

### Manual smoke tests
- Copy private media URL → incognito → fails after TTL
- Public media URL opens logged out and remains cacheable

### TODO file-path list
Worker:
- `ops/cloudflare/r2_media_worker/index.js`
  - method allowlist (GET/HEAD only)
  - add `X-Content-Type-Options: nosniff`
  - add `Referrer-Policy: no-referrer`
  - add `Cross-Origin-Resource-Policy: same-origin`
  - clamp unsafe content-types to octet-stream
  - short cache for 404; no-store for 401/403
  - (recommended) key prefix allowlist (e.g. `u/`)

Backend:
- `backend/siddes_media/token_urls.py` (warn/guard when token secret missing in worker-routed envs)

---

## Part 3 — Rendering UX (skeletons, retries, token refresh)

### Acceptance criteria (exact tests)
- Media tiles have skeletons, stable aspect ratio, and never show broken icons
- Expired private media:
  - shows “expired” UI and recovers via refresh without full reload
- Retry UI exists for transient failures
- Composer supports retry for failed upload without reselecting file

### Observability events needed
Client (privacy-safe):
- `media.render.error_{expired|forbidden|missing|network}`
- `media.refresh.request|success|fail`
- `media.upload.retry`

Backend:
- `media.refresh.authorized|forbidden`

### Manual smoke tests
- Let TTL expire while browsing → tile shows reload → recovers
- Offline mode shows “Offline” state; doesn’t spam retries

### TODO file-path list
Frontend:
- `frontend/src/components/PostCard.tsx` (introduce MediaTile behavior + modal resilience)
- **NEW** `frontend/src/components/media/MediaTile.tsx`
- `frontend/src/lib/mediaClient.ts` (refresh + token decode helpers)
- `frontend/src/app/siddes-compose/client.tsx` (retry + optional cancel)
- `frontend/src/components/PrismProfile.tsx` (optional reuse)

Next BFF:
- **NEW** `frontend/src/app/api/media/refresh/route.ts`

Backend:
- `backend/siddes_media/views.py` (add MediaRefreshUrlView: permission-checked, returns fresh `/m/*` URL)
- `backend/siddes_media/urls.py` (add route)
- `backend/siddes_media/tests.py` (refresh permission matrix)

---

## Part 4 — CDN Caching Strategy + Invalidation

### Acceptance criteria (exact tests)
- **Private** `/m/*` is never stored in SW cache; offline reload does not show it
- **Public** `/m/*` may be cached (SW + browser) only if explicitly cacheable
- Deleting a public post revokes old media URL server-side within target window
- Worker does not cache 401/403; 404 has short TTL

### Observability events needed
Backend:
- `media.invalidate.requested`
- `media.r2.delete.ok|fail`
- `media.gc.run`

Worker:
- `media.worker.not_found`, `media.worker.revoked` (if you implement revocation list)

### Manual smoke tests
- Verify SW CacheStorage does not contain private `/m/*` entries
- Delete a public post; old media URL becomes 404/410 within minutes

### TODO file-path list
**Critical privacy fix**
- `frontend/public/sw.js`
  - bypass caching for `/m/*` unless response is explicitly public+immutable
  - enforce cache size caps; clear on logout (optional)

Invalidation:
- `backend/siddes_post/views.py`
  - on post delete: delete bytes from R2 (+ purge edge for public)
- `backend/siddes_prism/views.py`
  - on avatar replace: delete old bytes (+ purge if public)

GC:
- **NEW** `backend/siddes_media/management/commands/purge_orphaned_media.py`
- (helper) **NEW** `backend/siddes_media/r2_delete.py`

Optional stronger revocation:
- `ops/cloudflare/r2_media_worker/index.js` (KV/DO revocation list → 410)

Docs:
- `docs/MEDIA_R2.md` (add caching layers + SW rules + invalidation)

---

## Part 5 — Monitoring & Alerting

### Acceptance criteria (exact tests)
- From logs/metrics you can compute: upload success rate, worker 401/404/503 rates, attach failures
- Secret mismatch triggers worker 401 spike and an alert
- R2 misconfig triggers sign-upload 503 `r2_not_configured` spike and an alert

### Observability events needed
Backend:
- `media.sign_upload.*`, `media.commit.*`, `media.url.*`, `post.media.attach.*`
- Never log tokens; scrub `t=` query param

Worker:
- status/deny reason logs (sampled)
- Range 206 counts

Client telemetry (optional):
- upload/render error buckets

### Alert plan (simple & effective)
P0:
- worker 503 > 0.5% for 5 min
- worker 401 spike > 10% for 5 min (often secret mismatch / missing tokens)
- backend sign-upload 503 r2_not_configured > 0.5% for 5 min
- worker 404 spike > 5% for 10 min

P1:
- post create 5xx correlated with mediaKeys
- latency p95 thresholds for sign-upload / media-url

### TODO file-path list
Backend:
- `backend/siddes_media/views.py` (emit media lifecycle logs)
- `backend/siddes_post/views.py` (emit attach logs)

Worker:
- `ops/cloudflare/r2_media_worker/index.js` (structured logs; optional debug header)

Client telemetry (optional):
- `frontend/src/lib/telemetry/sdTelemetry.ts`
- `backend/siddes_telemetry/views.py`
- `frontend/src/components/PostCard.tsx`
- `frontend/src/app/siddes-compose/client.tsx`

Synthetic canary:
- **NEW** `scripts/dev/media_canary_smoke.sh`

Docs:
- `docs/OBSERVABILITY.md` (media funnel + worker status interpretation)
- `docs/GO_LIVE_MASTER_RUNBOOK.md` (media alerts + triage tree)

---

# Configuration Matrix (single place to verify)
### Backend (Django) — R2 presign
- `SIDDES_R2_BUCKET`
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`
- `SIDDES_R2_ACCOUNT_ID` **or** `SIDDES_R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com`

### Backend (Django) — token URLs
- `SIDDES_MEDIA_TOKEN_SECRET` (must match Worker secret)
- `SIDDES_MEDIA_PRIVATE_TTL` (default 600; clamp 60..3600)
- Optional: `SIDDES_MEDIA_BASE` (if you want absolute URLs)

### Cloudflare Worker
- R2 binding: `MEDIA_BUCKET`
- Secret: `MEDIA_TOKEN_SECRET`
- Route: `https://<domain>/m/*` → Worker

### R2 bucket CORS (minimum)
- AllowedOrigins: prod + dev origins (**include the port you actually run**, e.g. 3000/3001)
- AllowedMethods: `PUT, GET, HEAD`
- AllowedHeaders: at least `Content-Type`
- ExposeHeaders: `ETag, Content-Length, Content-Type`
- MaxAgeSeconds: 3600+ (86400 fine)

---

# Recommended Execution Sequence (practical “do this in order”)
### Day 1 (get it working + safe)
1) Part 1: add missing BFF routes, harden sign-upload validation, make attach fail explicit  
2) Part 2: confirm Worker secrets match and `/m/*` behaves for pub/priv + Range  
3) Part 4 (partial): **fix SW caching for `/m/*`** so private isn’t persisted

### Day 3 (make it feel great)
4) Part 3: skeletons + retries + refresh endpoint for expired tokens

### Day 7 (make it durable)
5) Part 4 (full): delete/purge on post delete + avatar replace; add GC job  
6) Part 5: alerts + canary smoke + runbook

---

# Go-Live Gate (quick checklist)
- [ ] `/api/media/sign-upload` works in prod (200, not 404)
- [ ] R2 upload PUT succeeds in browser (no CORS errors)
- [ ] Private media: `/m/*` returns `private, no-store` and expires as expected
- [ ] SW does **not** cache private `/m/*`
- [ ] Public media: caches hard (`immutable`) and loads fast
- [ ] Deleting a public post revokes its media server-side
- [ ] Alerts are live for worker 503/401 spikes and sign-upload 503 spikes

