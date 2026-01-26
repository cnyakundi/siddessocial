# Siddes Go-Live Issue Register (Single Source of Truth)

This file is the launch gap register found by a real spider pass:
Frontend routes -> Next /api proxies -> Django endpoints -> stores/models.

Use this as the truth board while preparing the first public deployment.

## Deployment target (assumed)
- Frontend: Vercel (Next.js App Router)
- Backend: DigitalOcean (Django/DRF)
- Media: Cloudflare R2 (optionally via Cloudflare Worker for /m/*)

**Architecture assumption:** The browser talks only to the Vercel domain. All API calls go through Next `/api/*` routes which proxy to Django. This avoids CORS and keeps session cookies on one origin.

---

## How to use this register
Each issue includes:
- Severity: **P0** (blocker), **P1** (must fix soon), **P2** (cleanup)
- Fix: which `sd_###` script handles it (if you’ve already run it, mark it DONE)
- Verify: what to do to confirm it’s actually fixed

---

# P0 (Blockers - do NOT go live without these)

## P0.1 Media pipeline not fully wired end-to-end
**Symptom:** Image/video posting is not guaranteed to be real, rendered, and access-controlled end-to-end.

**Required behavior for launch:**
- Composer can attach images (upload) and post them
- Feed + Post detail render the attachments
- Private-side media can be viewed by allowed viewers (Side + Set membership), but cannot leak publicly
- `/m/*` serves media safely

**Fix available:** `sd_384_r6_media_pipeline_go_live_apply_helper.sh`  
(If you got a perl error earlier, run r6, not the older one.)

**Verify:**
1) Compose -> attach 1-4 images -> Post  
2) Confirm images appear on:
   - Feed card
   - Post detail page
3) Open the image as a different allowed viewer -> loads
4) Open the same `/m/...` URL in an incognito window -> should not expose private media

---

## P0.2 Production server + static files not guaranteed
**Symptom:** Dev-style server (`runserver`) and static config can break on real deployment.

**Fix available:** `sd_385_prod_deploy_pack_do_vercel_cf_apply_helper.sh`

**Verify (DigitalOcean):**
- `python manage.py collectstatic --noinput` works
- backend can boot using gunicorn start script (`backend/start_prod.sh` if provided by the script)

---

## P0.3 Production domains, CSRF, cookie rules must be explicit
**Symptom:** Auth + POST requests can fail silently on real domains if CSRF trusted origins and proxy SSL headers are wrong.

**Fix available:** run the latest `sd_390_*_prod_domains_cookies_csrf_apply_helper.sh` you have in Downloads.

**Verify:**
- On DigitalOcean: `python manage.py launch_check --strict` returns SAFE TO SHIP
- On production app domain:
  - login works
  - creating a post works (no CSRF failures)

---

## P0.4 Email go-live configuration (password reset, verification)
**Symptom:** Reset/verify flows break if SMTP/SendGrid is not configured.

**Fix available:** `sd_389_email_go_live_wiring_apply_helper.sh`

**Verify:**
- `python manage.py email_test --to your@email.com` succeeds
- password reset email link uses your real app base URL

---

## P0.5 Cloudflare /m serving must NOT leak private media
There are two safe launch modes:

### Mode A (simplest): Keep /m served by Next (signed redirects)
- Next `/m/*` redirects to short-lived signed R2 URLs
- Cloudflare does NOT edge-cache private items

### Mode B (edge): Cloudflare Worker token gate
- Worker serves R2 objects
- Worker requires token `?t=...` and sets:
  - public: cache immutable
  - private: no-store

**Fix available:** `sd_386_cloudflare_media_worker_token_gate_apply_helper.sh`

**Verify:**
- Private image link should fail in incognito or after token expiry

---

## P0.6 Contacts “suggestions” feature is disabled in production (dead path)
**Symptom:** Contacts suggestions return empty when DEBUG=false, so any UI that depends on it becomes dead in prod.

**Launch-safe position:** Hide the UI entrypoints in production until a privacy-safe suggestion service is ready.

**Fix available (if you already applied cleanup/deploy-ready):**
- `sd_382_repo_cleanup_deploy_ready_apply_helper.sh` (hides dev-only import entrypoints)

**Verify:**
- In production build, users should not see “Sync contacts” if it won’t work

---

## P0.7 Broken developer link / developer-only surfaces
**Symptom:** User-visible links to `/developer` or dev pages can 404 or expose internal tools.

**Launch-safe position:** Either implement `/developer` properly and gate it, or remove links in prod.

(If you used sd_382 cleanup earlier, this was already handled.)

---

# P1 (Important - should be addressed soon after launch)

## P1.1 “Hide post” is client-only
**Symptom:** Hide only removes the card locally; refresh brings it back.

**Fix (future):**
- Add per-viewer hidden posts model + endpoint
- Apply at feed query time

---

## P1.2 Redis is strongly recommended in production
**Symptom:** Without REDIS_URL, rate limits are per-instance (not shared) and less effective.

**Fix:** Use DO Managed Redis and set `REDIS_URL` on backend.

**Verify:** Django cache backend uses Redis (launch_check can be extended to enforce this later).

---

## P1.3 Provider safety: ensure no stub providers can ever run in production
**Symptom:** If a stub provider is selected by mistake, prod could return fake data.

**Fix:** Enforce a production guard at app boot (fail fast if stub provider selected).

---

# P2 (Cleanup / hygiene)

## P2.1 Repo bloat: backups, build artifacts, caches
**Fix available:** `sd_382_repo_cleanup_deploy_ready_apply_helper.sh`

**Verify:** No `.backup_*`, no `.next_build`, no `__pycache__` shipped.

## P2.2 Docs sprawl
You can keep many docs, but for launch you want a single “current truth”:
- `docs/SIDDES_BOOK.md` (handbook)
- `docs/GO_LIVE_MASTER_RUNBOOK.md` (ops)
- This Issue Register

---

# Environment Checklist (copy/paste targets)

## Vercel env vars
- `SD_INTERNAL_API_BASE=https://api.yourdomain.com`

## DigitalOcean env vars (minimum)
- `DJANGO_DEBUG=0`
- `DJANGO_SECRET_KEY=<strong secret>`
- `DJANGO_ALLOWED_HOSTS=api.yourdomain.com`
- `DJANGO_CSRF_TRUSTED=https://app.yourdomain.com`
- `SIDDES_PUBLIC_APP_BASE=https://app.yourdomain.com`
- `SIDDES_CONTACTS_PEPPER=<strong secret>`
- `DATABASE_URL=<managed postgres>`
- (recommended) `REDIS_URL=<managed redis>`

### Media (R2)
- `SIDDES_R2_BUCKET=...`
- `SIDDES_R2_ACCESS_KEY_ID=...`
- `SIDDES_R2_SECRET_ACCESS_KEY=...`
- `SIDDES_R2_ACCOUNT_ID=...` (or endpoint)

### If using Cloudflare Worker token gate
- `SIDDES_MEDIA_TOKEN_SECRET=<must match Worker MEDIA_TOKEN_SECRET>`
- optional: `SIDDES_MEDIA_PRIVATE_TTL=600`

---

# Post-deploy smoke tests (recommended)
If you have `sd_388` applied:
- `./scripts/post_deploy_smoke.sh https://app.yourdomain.com https://api.yourdomain.com`

Manual quick checks:
- `/api/auth/me` returns JSON
- `/api/feed?side=public&limit=1` returns JSON
- Create a text post
- Create an image post (after sd_384_r6)
