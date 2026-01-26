# Siddes Media Engine — Status Report (R2 + Worker + Upload UX)
**Date:** 2026-01-25  
**Source of truth audited:** `sidesroot_source_of_truth_clean_20260125_115706.zip`  

This doc is the “single-window” truth for the Media Engine workstream: what we were building, what is already in the repo right now, what’s broken/misconfigured, and the exact next steps to stabilize everything in one place.

---

## 1) What we were doing (scope)
Hardening Siddes’ end-to-end Media Engine:

- **Upload**: client → sign-upload → direct PUT to R2
- **Commit/attach**: bind media to a post or prism avatar and lock visibility
- **Serve**: `/m/*` same-origin (dev redirect vs Cloudflare Worker in prod)
- **Privacy**: token-gated URLs (public cacheable, private expiring)
- **Caching**: ensure private media is never persisted offline (Service Worker rules)
- **UX**: skeletons + retry + auto-refresh for expired private tokens
- **Ops**: env wiring, CORS, Worker routing/secrets
- **Monitoring**: events and alert thresholds for failures

---

## 2) Current repo status (what exists right now)

### ✅ Present and working in code (in this zip)
- **Media hardening fix pack doc exists**  
  - `docs/MEDIA_HARDENING_FIX_PACK.md`
- **Backend media endpoints exist (Django/DRF)**  
  - `backend/siddes_media/urls.py` includes:
    - `POST /api/media/sign-upload`
    - `POST /api/media/commit`
    - `GET  /api/media/url`
    - `GET  /api/media/refresh` ✅
- **Backend refresh endpoint implemented** (permission-checked)  
  - `backend/siddes_media/views.py` has `MediaRefreshUrlView`
- **Frontend media resiliency UI exists**
  - `frontend/src/lib/mediaClient.ts` includes:
    - `parseMediaTokenFromUrl(url)`
    - `refreshMediaUrl(r2Key)`
  - `frontend/src/components/PostCard.tsx` includes:
    - skeleton loading
    - retry overlay
    - “Expired → reload” behavior (calls refresh)
- **Service Worker privacy protection is present**
  - `frontend/public/sw.js`:
    - `/api/*` never cached
    - `/m/*` only cached if **explicitly public cacheable**, never cache `private`/`no-store`, never cache Range/video partials
- **Worker exists**
  - `ops/cloudflare/r2_media_worker/index.js` token gate + Range support (baseline)

---

## 3) Current blockers (must fix before uploads can work)

### ⛔ Blocker 1 — Missing Next BFF routes for media (frontend 404s)
In this zip, these routes are **missing**:
- `frontend/src/app/api/media/sign-upload/route.ts`
- `frontend/src/app/api/media/commit/route.ts`
- `frontend/src/app/api/media/refresh/route.ts`

**Impact**
- Composer and Prism avatar flows call `/api/media/*` on the Next origin → **404** → uploads/commit/refresh do not work end-to-end.

**Fix**
- Apply the BFF route patch (adds the three route handlers and forwards cookies + `x-sd-viewer` in dev).

---

### ⛔ Blocker 2 — Docker env wiring for R2 + token secret is missing
In this zip:
- `ops/docker/.env.example` is **missing**
- `ops/docker/docker-compose.dev.yml` backend `environment:` only includes:
  - `DATABASE_URL`, `REDIS_URL`, `DJANGO_DEBUG`
- No pass-through for:
  - `SIDDES_R2_*`
  - `SIDDES_MEDIA_TOKEN_SECRET`
  - `SIDDES_MEDIA_PRIVATE_TTL`

**Impact**
- Even after BFF routes exist, backend likely returns `r2_not_configured` because the container can’t see the R2 credentials.
- Token URLs for `/m/*` will break in prod if `SIDDES_MEDIA_TOKEN_SECRET` isn’t set.

**Fix**
- Restore `ops/docker/.env.example` and wire env vars through compose.

---

## 4) Standing misconfigurations / incomplete hardening (not blockers, but required)

### ⚠️ Backend sign-upload hardening is NOT present in this zip
`backend/siddes_media/views.py` (`MediaSignUploadView`) currently:
- does **not** enforce content-type allowlists by kind
- does **not** enforce max byte limits
- treats unknown content-type as `application/octet-stream`

**Risk**
- Incorrect media types slip through; potential same-origin content-type weirdness.

**Fix**
- Add allowlists + size caps + safer ext/content-type normalization (server-side).

---

### ⚠️ Post create media attach currently swallows failures (silent drop)
`backend/siddes_post/views.py` commit/attach block includes:
- `except Exception: pass`

**Risk**
- A post can be created while attachments silently fail → “ghost media” bugs.

**Fix**
- Fail closed: return `media_commit_failed` (and keep post consistent).

---

### ⚠️ Worker hardening not applied
Current worker (`ops/cloudflare/r2_media_worker/index.js`) does **not** yet:
- restrict to **GET/HEAD only**
- set `X-Content-Type-Options: nosniff`
- set `Referrer-Policy: no-referrer`
- set `Cross-Origin-Resource-Policy: same-origin`
- clamp unsafe `Content-Type` to octet-stream
- short-cache 404 / no-store for 401/403
- restrict key prefix (e.g. only `u/`)

**Risk**
- More leak surface, token in referer, unsafe content sniffing.

---

### ⚠️ Public media revocation + GC not implemented
Still missing:
- delete bytes from R2 on post delete / avatar replace (public revocation)
- garbage-collect orphaned pending uploads
- optional Worker-side revocation list (410)

---

### ⚠️ Monitoring/alerts not implemented
Need structured events:
- `media.sign_upload.issued/rejected`
- `media.commit.ok/fail`
- Worker deny reasons (missing/bad_sig/expired/key_mismatch)
…and alert thresholds (401 spike, 503 spike, 404 spike).

---

## 5) “One window / one source of truth” plan (recommended)
To stop multi-window drift:

1) Treat **this zip** as the only source of truth.
2) Close other editor windows or stop applying patches elsewhere.
3) Apply fixes in this order (lowest risk → highest impact):
   1. **BFF routes** (unblocks everything)
   2. **Docker env wiring** (unblocks real uploads with R2)
   3. **Backend sign-upload hardening**
   4. **Fail-closed post attach**
   5. **Worker hardening**
   6. **Public revocation + GC**
   7. **Monitoring + alerts**

4) After each step, run the same gates:
   - `./verify_overlays.sh`
   - `cd frontend && npm run typecheck && npm run build`
   - `docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py test siddes_media`

---

## 6) Verification checklist (how to confirm you’re green)

### A) BFF routes (no more 404)
- In browser, attach a file in composer.
- DevTools → Network:
  - `POST /api/media/sign-upload` should return **NOT 404**
  - if R2 not configured yet: expect `503 r2_not_configured` (acceptable until env is set)

### B) R2 env is wired (no more r2_not_configured)
- After you set R2 env vars in `ops/docker/.env` and restart docker:
  - `POST /api/media/sign-upload` should return **200** with a presigned PUT URL

### C) Private token expiry recovery
- Make a private post with an image.
- Wait past `SIDDES_MEDIA_PRIVATE_TTL` (default 600s)
- Re-open feed:
  - PostCard should show “Expired” briefly, then reload.

### D) Service Worker safety
- Load a private image.
- Go offline and refresh:
  - private media should **not** persist.

---

## 7) Current “Remaining Work” checklist (single list)
- [ ] Add Next BFF routes for `/api/media/sign-upload`, `/api/media/commit`, `/api/media/refresh`
- [ ] Restore `ops/docker/.env.example` and wire `SIDDES_R2_*` + `SIDDES_MEDIA_*` into docker-compose
- [ ] Backend sign-upload hardening (allowlists + size caps)
- [ ] Backend commit idempotency / prevent repointing committed keys
- [ ] Make post attach fail-closed (remove silent `except: pass`)
- [ ] Worker hardening (headers, methods, content-type clamp, error cache rules, key prefix allowlist)
- [ ] Public revocation on delete (R2 delete + purge strategy)
- [ ] Orphan GC job (pending/unused media)
- [ ] Monitoring events + alert thresholds + runbook

---

## Appendix: quick file map (for this workstream)
- Backend media:
  - `backend/siddes_media/views.py`
  - `backend/siddes_media/urls.py`
  - `backend/siddes_media/token_urls.py`
- Backend posts:
  - `backend/siddes_post/views.py` (commit/attach media block)
- Frontend:
  - `frontend/src/lib/mediaClient.ts`
  - `frontend/src/app/siddes-compose/client.tsx`
  - `frontend/src/components/PostCard.tsx`
  - `frontend/src/app/m/[...key]/route.ts` (dev redirect)
  - `frontend/public/sw.js`
- Worker:
  - `ops/cloudflare/r2_media_worker/index.js`
- Docker:
  - `ops/docker/docker-compose.dev.yml`
  - `ops/docker/.env.example` (currently missing in this zip)
