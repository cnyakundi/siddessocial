# Phase 2.12 - Media (Cloudflare R2 attachments + /m serving)

This pack maps Siddes' **media pipeline** end-to-end:

**Compose UI -> sign upload -> direct PUT to R2 -> attach to Post -> render via /m/**

Scope: **structural + data-contract mapping only** (no fix suggestions).

---

## 0) Topology (one-screen mental model)

**Upload path**
1. `siddes-compose` picks images (browser File API)
2. `POST /api/media/sign-upload` -> returns `{ r2Key, upload.url }`
3. Browser `PUT upload.url` (direct to R2)
4. `POST /api/post` with `mediaKeys: [r2Key...]`
5. Backend attaches keys to the new Post + marks `MediaObject` committed

**Serve path**
1. Backend includes `post.media[]` with a `url` field (same-origin `/m/<key>` + optional token)
2. `PostCard` renders `<img src=url>` / `<video src=url>`
3. `/m/*` resolves to:
   - **Production**: Cloudflare Worker bound to R2 (token validated)
   - **Dev fallback**: Next route `GET /m/*` -> backend `GET /api/media/url` -> 302 to short-lived presigned GET

---

## 1) User-facing surfaces (frontend)

### 1.1 Compose attachments (upload UI)
- File: `frontend/src/app/siddes-compose/client.tsx`
- What it does: lets a user attach up to **4 images**, uploads them to R2, and sends their `r2Key`s alongside a post.

State dependencies (main hooks used):
- `useState`: `mediaItems[]` with status (`uploading|ready|failed`)
- `useRef`: `fileInputRef` (hidden input), mount guards
- `useEffect`: clears attachments on Side change (context safety)
- `useMemo`: derives `mediaKeys` from `mediaItems`

Key integration points:
- Calls `signUpload()` + `uploadToSignedUrl()` from `frontend/src/lib/mediaClient.ts`.
- Sends `mediaKeys` in the post create request:
  - `fetch("/api/post", { body: { side, text, ..., mediaKeys } })`

### 1.2 Feed/PostDetail rendering (MediaGrid)
- File: `frontend/src/components/PostCard.tsx`
- What it does: renders `post.media[]` as either a single large item or a 2x2 grid.
- Dependency pattern: derives `mediaItems` from `(post as any).media` via `useMemo`.

Media object expectations (client-side):
- Each item must include at least: `{ id, url, kind }`.
- `url` is used directly as `src` for `<img>` or `<video>`.

### 1.3 PostDetail uses PostCard for media
- File: `frontend/src/app/siddes-post/[id]/page.tsx`
- What it does: renders the focused post via `<PostCard post={found.post} ... />`, so attachments display identically on Feed and Detail.

### 1.4 Frontend type contract
- File: `frontend/src/lib/feedTypes.ts`
- Type: `MediaAttachment`
  - `id: string`
  - `r2Key: string`
  - `kind: "image" | "video"`
  - `contentType?: string`
  - `url: string` (same-origin `/m/<r2Key>`; may include token query)

### 1.5 Media client service
- File: `frontend/src/lib/mediaClient.ts`
- What it does:
  - `signUpload(file, kind)` -> `POST /api/media/sign-upload`
  - `uploadToSignedUrl(url, file, headers)` -> `PUT` to the presigned URL

### 1.6 Same-origin `/m/*` router (Next)
- File: `frontend/src/app/m/[...key]/route.ts`
- What it does: resolves `/m/<key>` by calling backend `GET /api/media/url?key=` and returning a **302 redirect** to a short-lived signed GET URL.

---

## 2) Next.js server layer (API + media serving)

### 2.1 `/m/*` redirect handler (present in this tree)
- Endpoint: `GET /m/<path>`
- File: `frontend/src/app/m/[...key]/route.ts`
- Backend target: `GET /api/media/url?key=<r2Key>`
- Proxy helper: `proxyJson()` from `frontend/src/app/api/auth/_proxy.ts`
- Dev viewer support: injects `x-sd-viewer` using `resolveStubViewer()` (`frontend/src/lib/server/stubViewer.ts`) when not production.

### 2.2 `/api/media/*` Next proxies (expected building blocks)
These routes are referenced by the client (`frontend/src/lib/mediaClient.ts`) and the project docs, and their canonical content exists in:
- `scripts/sd_384_media_pipeline_go_live_apply_helper.sh` (writes the Next route handlers)
- `docs/MEDIA_R2.md` (integration spec)

Canonical Next route handler paths:
- `frontend/src/app/api/media/sign-upload/route.ts` -> proxies Django `POST /api/media/sign-upload`
- `frontend/src/app/api/media/commit/route.ts` -> proxies Django `POST /api/media/commit`
- `frontend/src/app/api/media/url/route.ts` -> proxies Django `GET /api/media/url?key=`

(Structural note: in this particular source snapshot, the `/api/media/*` folder is not present under `frontend/src/app/api/`, but the system design and scripts treat it as part of the runtime surface.)

---

## 3) Django API layer (backend)

### 3.1 Backend endpoints
- URLConf: `backend/siddes_media/urls.py`
- Views: `backend/siddes_media/views.py`

Endpoints:
- `POST /api/media/sign-upload` -> `MediaSignUploadView`
- `POST /api/media/commit` -> `MediaCommitView`
- `GET  /api/media/url?key=<r2Key>` -> `MediaSignedUrlView`

### 3.2 Backend `/m/*` dev fallback
- Mounted in: `backend/siddes_backend/urls.py`
- Endpoint: `GET /m/<path:key>` -> `MediaRedirectView`
- Purpose: dev-only style redirect to a short-lived presigned GET URL.

### 3.3 Media registry model
- File: `backend/siddes_media/models.py`
- Model: `MediaObject`
  - `id` (string PK)
  - `owner_id` (viewer id)
  - `r2_key` (unique)
  - `kind` (`image|video`)
  - `content_type`
  - `bytes`, `width`, `height`, `duration_ms` (optional)
  - `is_public` (bool)
  - `status` (`pending|committed`)
  - `created_at` (float timestamp)
  - `post_id` (nullable string) — attachment pointer

### 3.4 Tokenized media URLs (for Worker)
- File: `backend/siddes_media/token_urls.py`
- Key functions:
  - `mint_media_token(key, is_public)` — returns `payload.sig` (HMAC)
  - `build_media_url(key, is_public, base_url?)` — returns `/m/<key>?t=<token>` when secret exists

### 3.5 Presigned GET/PUT signing (S3-compatible)
- File: `backend/siddes_media/signing.py`
- Key function: `presign_s3_url(method, endpoint, bucket, key, access_key_id, secret_access_key, expires, region='auto', service='s3')`
- Note: implemented manually (no boto3 dependency).

### 3.6 Post attachment integration point
- File: `backend/siddes_post/views.py`
- Media integration points:
  - `_parse_media_keys(body)` parses `mediaKeys` input
  - PostCreateView validates keys (owned by viewer, unused) and attaches them
  - `_media_for_post(post_id)` emits `post.media[]` in responses

---

## 4) Ops layer (Cloudflare Worker)

### 4.1 Worker entrypoint
- File: `ops/cloudflare/r2_media_worker/index.js`
- Route: `GET /m/<key>?t=<token>`
- R2 binding: `env.MEDIA_BUCKET.get(key, { range? })`

### 4.2 Token validation contract
- Required secret: `MEDIA_TOKEN_SECRET` (Worker)
- Must match backend: `SIDDES_MEDIA_TOKEN_SECRET`
- Token format: `<base64url(json_payload)>.<base64url(hmac_sha256(payload))>`
- Payload fields:
  - `k` (key)
  - `m` (`pub|priv`)
  - `e` (expiry, optional; present for private)

### 4.3 Range support
- Worker parses `Range: bytes=start-end` and returns:
  - `206 Partial Content` + `Content-Range`
  - `Accept-Ranges: bytes`

### 4.4 Cache rules
- Public token mode (`m=pub`): `Cache-Control: public, max-age=31536000, immutable`
- Private token mode (`m=priv`): `Cache-Control: private, no-store`

---

## 5) Data contracts

### 5.1 MediaAttachment object (in post payloads)
Produced by backend post views; consumed by `PostCard`.

```json
{
  "id": "m_...",
  "r2Key": "u/me_1/<uuid>.png",
  "kind": "image",
  "contentType": "image/png",
  "url": "/m/u/me_1/<uuid>.png?t=<token>"
}
```

### 5.2 `POST /api/media/sign-upload`
Request (JSON):
- `kind`: `"image" | "video"` (required)
- `contentType`: string (optional; defaults to `application/octet-stream`)
- `bytes`: number (optional)
- `ext`: string (optional; derived from `contentType` if missing)

Response (HTTP 200 on success):
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_1",
  "role": "me",
  "media": {
    "id": "m_<uuid>",
    "r2Key": "u/me_1/<uuid>.png",
    "kind": "image",
    "contentType": "image/png",
    "status": "pending"
  },
  "upload": {
    "method": "PUT",
    "url": "https://<account>.r2.cloudflarestorage.com/<bucket>/u/me_1/<uuid>.png?...",
    "headers": {"content-type": "image/png"},
    "expiresIn": 300
  },
  "serve": {"url": "/m/u/me_1/<uuid>.png?t=<token>"}
}
```

Restricted (not logged in) response pattern (HTTP 200):
```json
{ "ok": true, "restricted": true, "viewer": null, "role": "anon" }
```

### 5.3 Direct upload to R2 (browser)
- Method: `PUT` to `upload.url` (presigned)
- Headers: include `content-type` (provided in `upload.headers`)
- Body: raw file bytes

### 5.4 `POST /api/media/commit`
Request (JSON):
- `r2Key` (or `key`): string (required)
- `isPublic` (or `public`): truthy string/number (optional)
- `postId` (optional): string

Response:
```json
{
  "ok": true,
  "restricted": false,
  "media": {
    "id": "m_<uuid>",
    "r2Key": "u/me_1/<uuid>.png",
    "status": "committed",
    "isPublic": false,
    "postId": "p_..."
  }
}
```

### 5.5 `GET /api/media/url?key=<r2Key>`
Response:
```json
{
  "ok": true,
  "restricted": false,
  "url": "https://<account>.r2.cloudflarestorage.com/<bucket>/u/me_1/<uuid>.png?...",
  "expiresIn": 60,
  "media": {
    "r2Key": "u/me_1/<uuid>.png",
    "kind": "image",
    "contentType": "image/png",
    "isPublic": false
  }
}
```

### 5.6 `GET /m/<r2Key>`
Two serving modes:
- **Cloudflare Worker (recommended prod):** `/m/<key>?t=<token>` -> streams from R2
- **Dev redirect fallback:** `/m/<key>` -> 302 to `GET /api/media/url` presigned URL

---

## 6) Guardrails (privacy + safety)

### 6.1 Who can upload
- Backend `MediaSignUploadView` requires:
  - viewer present, role == `me` (owner)
  - otherwise returns `{ restricted: true }` (no viewer) or `403 forbidden` (non-me role)

### 6.2 Who can fetch private media
- Backend `MediaSignedUrlView` rules:
  - public objects: any viewer
  - private objects: owner **or** a viewer who can view the attached post (via `_viewer_can_view_post()`)

### 6.3 Attachment constraints
- Compose: clears attachments on Side change (context-safety)
- Backend post create:
  - max **4** keys (`too_many_media`)
  - keys must exist, be owned by the poster, and not already attached
  - on attach: marks media `committed`, sets `post_id`, sets `is_public` when post side is Public

### 6.4 Caching / leak prevention
- Next `/m/*` handler forces `cache-control: no-store` (redirects are short-lived)
- Worker:
  - public media cacheable hard
  - private media `no-store` + short TTL tokens

---

## 7) Third-party tissue + configuration

### 7.1 Cloudflare R2 (backend presigning)
Env vars used in `backend/siddes_media/views.py`:
- `SIDDES_R2_ACCOUNT_ID` (or `SIDDES_R2_ENDPOINT`)
- `SIDDES_R2_BUCKET`
- `SIDDES_R2_ACCESS_KEY_ID`
- `SIDDES_R2_SECRET_ACCESS_KEY`

### 7.2 Token secret (backend ↔ worker)
- Backend: `SIDDES_MEDIA_TOKEN_SECRET` (mints tokens)
- Worker: `MEDIA_TOKEN_SECRET` (verifies tokens)
- Optional TTL: `SIDDES_MEDIA_PRIVATE_TTL` (backend token TTL clamp 60s..1h)

### 7.3 Cloudflare Worker bindings
- R2 binding expected: `MEDIA_BUCKET` (see `wrangler.toml`)

### 7.4 Browser / platform dependencies
- Browser File API + `URL.createObjectURL` previews (compose)
- `fetch` PUT for direct uploads
- `<video>` + Range support (worker implements Range parsing)

---

## 8) File index (complete inventory for this subsystem)

### Frontend
- `frontend/src/app/siddes-compose/client.tsx` (upload UI + mediaKeys in post create)
- `frontend/src/lib/mediaClient.ts` (signUpload + PUT helper)
- `frontend/src/components/PostCard.tsx` (MediaGrid renderer)
- `frontend/src/lib/feedTypes.ts` (MediaAttachment type)
- `frontend/src/app/m/[...key]/route.ts` (same-origin media redirect)
- `frontend/src/lib/server/stubViewer.ts` (dev viewer injection helper)
- `frontend/src/app/api/auth/_proxy.ts` (proxyJson used by /m route)

### Backend
- `backend/siddes_media/urls.py`
- `backend/siddes_media/views.py`
- `backend/siddes_media/models.py`
- `backend/siddes_media/token_urls.py`
- `backend/siddes_media/signing.py`
- `backend/siddes_backend/urls.py` (mounts `/m/<path:key>`)
- `backend/siddes_post/views.py` (attach + emit media on posts)

### Ops
- `ops/cloudflare/r2_media_worker/index.js`
- `ops/cloudflare/r2_media_worker/wrangler.toml`
- `ops/cloudflare/r2_media_worker/README.md`

### Docs / scripts (wiring signals)
- `docs/MEDIA_R2.md`
- `scripts/sd_384_media_pipeline_go_live_apply_helper.sh` (writes canonical Next `/api/media/*` proxies)
