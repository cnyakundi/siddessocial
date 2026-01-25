# Siddes — Consolidated Status Report (Source-of-Truth Zip Audit)
Date: 2026-01-25  
Snapshot audited: `sidesroot_source_of_truth_clean_20260125_115706.zip`

This is a single, consolidated “where we are” report intended to stop the multi-window drift. It captures:
- what the Email Engine / auth-link workstream has been focusing on,
- what is already implemented **in the latest zip**, and
- what is still missing / misconfigured before we proceed.

---

## 1) Focus Area (what we were doing)

### A) Email Engine (transactional + security)
Goal: reliable, safe transactional email for:
- Email verification
- Password reset
- Magic-link sign-in (if enabled)
- Account lifecycle confirmations (email change / delete) — future

Quality bar:
- links must be safe (hashed tokens, TTL, single-use),
- auth actions must end in a valid session on the app domain (Next cookie bridge),
- dev vs prod provider wiring must be clean.

### B) QA Stability (what was blocking momentum)
Goal: make the repo “green” and repeatable:
- backend migrations run clean (no “DuplicateTable” traps),
- backend auth tests exist and run,
- frontend builds/typechecks,
- Playwright e2e tests can seed posts without CSRF failures.

---

## 2) What is already implemented in this zip (✅ done)

### 2.1 Email Engine baseline is present
Docs:
- `docs/EMAIL.md`
- `docs/EMAIL_GO_LIVE.md`
- `docs/PASSWORD_RESET.md`

Provider wiring:
- `backend/siddes_backend/emailing.py`
  - `SD_EMAIL_PROVIDER=console|smtp|sendgrid`
  - SMTP env support (`SD_SMTP_*`)
  - SendGrid API key support (`SD_SENDGRID_API_KEY`)

### 2.2 Auth email/token flows exist and are secure-by-default
Backend modules:
- `backend/siddes_auth/email_verification.py`
- `backend/siddes_auth/password_reset.py`
- `backend/siddes_auth/magic_link.py`

Token model/migration:
- `backend/siddes_auth/migrations/0009_email_engine_consistency.py` creates `MagicLinkToken`
- Token storage pattern across flows:
  - raw token generated via strong randomness
  - stored as **sha256 hash** (token_hash)
  - has `expires_at` and `used_at` (single-use)

### 2.3 “Session payload” contract is implemented (very important)
These endpoints return a `session` payload so Next can set cookies on the app domain:
- Password reset confirm ✅ (`backend/siddes_auth/password_reset.py`)
- Verify confirm ✅ (`backend/siddes_auth/email_verification.py`)
- Magic link consume ✅ (`backend/siddes_auth/magic_link.py`)

Frontend cookie bridge exists:
- `frontend/src/app/api/auth/_cookie.ts` reads `data.session` and applies the cookie.

### 2.4 Auth tests exist and run
- `backend/siddes_auth/tests.py` includes **4 smoke tests** validating:
  - reset request anti-enumeration behavior,
  - confirm endpoints authenticate via session cookie,
  - token single-use behavior.

### 2.5 Observability pack is present + working
- `docs/OBS_PACK_INDEX.md` and many observability docs exist
- scripts exist and run locally:
  - `scripts/obs/fire_drill.sh`
  - `scripts/obs/incident_drills.sh`
- Observability baseline check passes:
  - `bash scripts/checks/observability_baseline_check.sh`

---

## 3) Known misconfigurations & blockers (🔴 must fix before proceeding)

### 3.1 DEV database migration mismatch: `DuplicateTable` on MagicLinkToken
Symptom seen in your terminal:
- `Applying siddes_auth.0009_email_engine_consistency...`
- `DuplicateTable: relation "siddes_auth_magiclinktoken" already exists`

Cause:
- The DB already has the `siddes_auth_magiclinktoken` table,
- but Django migration history does **not** record 0009 as applied.

Fix (safe):
1) Verify the table exists:
   ```bash
   docker compose -f ops/docker/docker-compose.dev.yml exec backend      python manage.py shell -c "from django.db import connection; print('siddes_auth_magiclinktoken' in connection.introspection.table_names())"
   ```
2) If it prints `True`, fake-apply the migration:
   ```bash
   docker compose -f ops/docker/docker-compose.dev.yml exec backend      python manage.py migrate siddes_auth 0009_email_engine_consistency --fake
   ```
3) Then run full migrate:
   ```bash
   docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate
   ```
4) Confirm:
   ```bash
   docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py showmigrations siddes_auth
   ```
   You want `[X] 0009_email_engine_consistency`.

---

### 3.2 Playwright E2E tests fail seeding posts: CSRF cookie not set
Symptom seen:
- `seed post failed (403): {"detail":"CSRF Failed: CSRF cookie not set."...}`

Cause:
- `frontend/tests/e2e/utils.ts` has `csrfPost()` that only sets `x-csrftoken` **if** a token was found.
- If `ensureCsrf()` fails to read the cookie, the helper still POSTs, causing a 403.

Fix (required behavior for e2e):
- `csrfPost()` must be strict:
  - call `/api/auth/csrf`
  - re-check cookie jar
  - if cookie still missing, parse `Set-Cookie` and inject into Playwright context
  - if still missing, throw a clear error (do **not** POST without token)

---

### 3.3 Contract check script points to the wrong file
Current:
- `scripts/checks/auth_session_payload_contract_check.sh` checks `frontend/src/app/api/auth/_proxy.ts`

Reality:
- Cookie bridge lives in `frontend/src/app/api/auth/_cookie.ts`

Fix:
- Update the check script to validate `_cookie.ts` reads `data.session` and applies cookies, not `_proxy.ts`.

---

## 4) What remains (🟠 not in the latest zip yet)

### 4.1 Deliverability “real world” hardening (not implemented yet)
Still missing (code-level):
- bounce/complaint monitoring ingestion (SendGrid event webhook or equivalent)
- suppression list for hard bounces/complaints
- provider-side correlation fields (e.g., Feedback-ID / metadata tags)

Still missing (ops-level):
- SPF / DKIM / DMARC setup and rollout plan (required before serious volume)

### 4.2 Token hygiene hardening
Current state: single-use tokens exist, but these are not fully enforced:
- “only one active token per flow” is not guaranteed for reset/verify/magic (cooldown helps, but older tokens can remain valid)

### 4.3 Email template improvements
- Most emails do not explicitly state TTL (“expires in X hours/minutes”)
- Plain-text fallbacks exist, but copy is not consistently phishing-hardened (“This link goes to: …”, etc.)

---

## 5) One unified plan (to stop the multi-window drift)

**Rule: this zip is the source of truth.**  
We stabilize it, then proceed.

### Step A — Stabilization Gate (must pass)
Run in this order:
1) Fix dev migrate mismatch (section 3.1)
2) Fix e2e CSRF helper (section 3.2)
3) Fix contract check script (section 3.3)

Gate commands (after fixes):
```bash
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py test siddes_auth
cd frontend && npm run typecheck && npm run build
cd frontend && npm run e2e tests/e2e/feed_pagination_ui.spec.ts tests/e2e/feed_scroll_restore.spec.ts
```

### Step B — Email Engine “100%” hardening (next phase after Gate is green)
1) Deliverability + DNS plan (SPF/DKIM/DMARC)
2) Provider event webhooks + suppression list
3) Token policy: “one active token per user per flow”
4) Template hardening: explicit TTL + phishing cues

---

## 6) Quick “current status” summary
✅ Email Engine baseline exists and works in dev (console)  
✅ Password reset / verify / magic return session payload and log user in  
✅ `siddes_auth` tests exist and pass  
✅ Observability pack exists and fire drill runs

🔴 Dev DB migration mismatch can break migrate (`DuplicateTable`)  
🔴 Playwright e2e fails due to CSRF bootstrap weakness  
🟠 Contract check script should validate `_cookie.ts` not `_proxy.ts`  
🟠 Deliverability monitoring + bounces/complaints not yet implemented  
🟠 Token “one active token per flow” not yet implemented

---

### Appendix: Key files touched in this workstream
- Email provider: `backend/siddes_backend/emailing.py`
- Auth flows: `backend/siddes_auth/{password_reset,email_verification,magic_link}.py`
- MagicLink migration: `backend/siddes_auth/migrations/0009_email_engine_consistency.py`
- Cookie bridge: `frontend/src/app/api/auth/_cookie.ts`
- E2E helpers: `frontend/tests/e2e/utils.ts`
