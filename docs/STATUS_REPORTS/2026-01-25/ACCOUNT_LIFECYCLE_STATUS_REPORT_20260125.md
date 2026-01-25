# Account Lifecycle Engine — Status Report (2026-01-25)

**Snapshot audited:** `sidesroot_source_of_truth_clean_20260125_115706.zip`  
**Snapshot hash (sha256, first 16):** `c895de2b7617ad12`  
**Scope:** signup → email verify → login (password/Google/magic) → sessions → password reset → deactivate → delete → export  
**Goal:** one clear “where we are” doc so you can stop juggling multiple windows/scripts.

---

## 1) What we were focusing on

### The core problem
Siddes uses a **Next.js proxy** for `/api/auth/*`. The proxy **does not trust backend `Set-Cookie` for `sessionid`** and instead sets the session cookie on the **app domain** using a JSON payload: `data.session`.

That makes one thing mission-critical:

> Any backend endpoint that logs a user in MUST return a JSON `session` payload, or the browser will **not** stay logged in.

This was the source of the classic “verify/reset succeeded but I’m still logged out / can’t see my account” class of bugs.

---

## 2) What is DONE (verified in this zip)

### A) Session-cookie contract fixed where it matters
These confirm endpoints now include a session payload so Next can set `sessionid` correctly:

- ✅ **Email verify confirm** returns `session`:  
  `backend/siddes_auth/email_verification.py`
- ✅ **Password reset confirm** returns `session`:  
  `backend/siddes_auth/password_reset.py`
- ✅ **Magic-link consume** returns `session`:  
  `backend/siddes_auth/magic_link.py`
- ✅ **Email-change confirm** returns `session` + expiry hints:  
  `backend/siddes_auth/account_lifecycle.py`

**Proxy cookie-setting is present**:
- ✅ `frontend/src/app/api/auth/_cookie.ts` (`applyProxyCookies()` sets HttpOnly, Secure in prod, SameSite=Lax, expiry hints)

### B) Real-world recovery UX (token paste fallback)
These pages support token paste (not just `?token=`):

- ✅ `/verify-email` → `frontend/src/app/verify-email/page.tsx`
- ✅ `/reset-password` → `frontend/src/app/reset-password/page.tsx`
- ✅ `/confirm-email-change` → `frontend/src/app/confirm-email-change/page.tsx`
- ✅ `/confirm-delete` → `frontend/src/app/confirm-delete/page.tsx`

Magic link UI exists:
- ✅ `/magic-request` and `/magic` pages

### C) Abuse controls (privacy-safe)
Per-identifier hashed throttles exist and are wired:

- ✅ password reset request identifier throttle (`auth_pw_reset_ident`)
- ✅ magic link request identifier throttle (`auth_magic_ident`)
- ✅ login already has identifier throttle (`auth_login_ident`)

### D) Guardrail checks exist (prevents regressions)
These checks are present in `scripts/checks/` and run via `./scripts/run_tests.sh`:

- ✅ `scripts/checks/auth_session_payload_contract_check.sh`
- ✅ `scripts/checks/email_console_token_redaction_check.sh`

### E) Single consolidated spec doc exists
- ✅ `docs/ACCOUNT_LIFECYCLE_ENGINE.md` exists as the “one doc” spec.

---

## 3) Standing issues / what is REMAINING (actionable)

### 3.1 Token redaction bug in console email preview (small but real)
In:
- `backend/siddes_backend/emailing.py`

The sanitizer currently uses a control character in replacement:
- `s = _TOKEN_QS_RE.sub(r"\x01<redacted>", s)` effectively became `r"\x01"` → shows up as `\u0001`

**Impact:** tokens are still mostly redacted, but the preview can contain weird output and is not “clean”.

**Fix:** replacement must preserve the captured group `token=` using `\1`, like:
- `sub(r"\1<redacted>", s)`

### 3.2 Confirm endpoints accept GET in production
Both include a `get()` handler:
- `backend/siddes_auth/email_verification.py`
- `backend/siddes_auth/password_reset.py`

**Impact:** unnecessary attack surface. Frontend already uses POST.

**Spec requirement:** allow GET only in DEBUG (dev convenience), return 405 in production.

### 3.3 Docs drift (causes “multiple window confusion”)
- `docs/STATE.md` is outdated (shows **Updated: 2026-01-19**)
- `docs/ACCOUNT_LIFECYCLE.md` still reads like the older “sd_324 lifecycle notes”
- `docs/ACCOUNT_LIFECYCLE_ENGINE.md` is present but not referenced as the canonical doc.

**Fix:** make the engine doc the canonical source and link from the older doc; update STATE date + lifecycle status.

### 3.4 Deployment misconfig hotspots (most common “proxy_fetch_failed” causes)
These are not code bugs, but missing env values breaks auth flows.

**Frontend/Next env (server-side proxy):**
- `SD_INTERNAL_API_BASE` **(production must set)**  
  If missing in production, Next fails closed and you get `proxy_fetch_failed`.
- `NEXT_PUBLIC_API_BASE` (optional; used as a fallback)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (only affects Google button rendering)

**Backend/Django env:**
- `DJANGO_CSRF_TRUSTED` **(production must set correct https origins)**
- `SIDDES_PUBLIC_APP_BASE` **(email links in verify/reset/magic/delete/email-change)**
- `SD_EMAIL_PROVIDER` + SMTP credentials (if not using console)
- `GOOGLE_OAUTH_CLIENT_ID` (backend verification for Google tokens)

---

## 4) Single “Misconfigurations Checklist” (use this before moving on)

### Local dev (typical)
- Frontend: `http://localhost:3001`
- Backend: `http://127.0.0.1:8000`

**Recommended:**
- `SD_INTERNAL_API_BASE=http://127.0.0.1:8000`
- `DJANGO_CSRF_TRUSTED=http://localhost:3001,http://127.0.0.1:3001`
- `SIDDES_PUBLIC_APP_BASE=http://localhost:3001`
- `SD_EMAIL_PROVIDER=console`

### Production (minimum required)
- `SD_INTERNAL_API_BASE=https://<YOUR_BACKEND_ORIGIN>`
- `DJANGO_CSRF_TRUSTED=https://<YOUR_APP_ORIGIN>`
- `SIDDES_PUBLIC_APP_BASE=https://<YOUR_APP_ORIGIN>`
- `DJANGO_DEBUG=0`, `SESSION_COOKIE_SECURE=1`, `CSRF_COOKIE_SECURE=1`

---

## 5) What we should do next (one clean path)

### Step 1 — Apply the audit fix pack (recommended next overlay)
Fixes:
- email preview redaction string
- GET confirm dev-only
- docs drift cleanup (STATE + lifecycle doc pointer)

(You already have an apply-helper prepared for this: `sd_567_lifecycle_audit_fixes_apply_helper.sh`.)

### Step 2 — Run the standard checks
- `./verify_overlays.sh`
- `./scripts/run_tests.sh`
- `cd frontend && npm run typecheck && npm run build`

### Step 3 — Run the lifecycle smoke tests
- Signup → verify email (link + token paste)
- Forgot password → reset confirm (link + token paste)
- Magic request → magic consume (link + token paste)
- Settings → sessions list + logout everywhere
- Danger zone → deactivate + delete request/confirm
- Export download

---

## 6) Quick “where to look” file map (for sanity)

### Backend
- Signup/login/google/magic: `backend/siddes_auth/views.py`, `magic_link.py`
- Verify: `backend/siddes_auth/email_verification.py`
- Reset: `backend/siddes_auth/password_reset.py`
- Lifecycle (email-change/deactivate/delete/export/sessions): `backend/siddes_auth/account_lifecycle.py`
- Email provider + console preview: `backend/siddes_backend/emailing.py`

### Frontend
- Auth screens: `frontend/src/app/login`, `signup`, `forgot-password`, `reset-password`, `verify-email`
- Confirm screens: `frontend/src/app/confirm-delete`, `confirm-email-change`, `magic`
- Proxy glue: `frontend/src/app/api/auth/_proxy.ts`, `_cookie.ts`

---

## 7) Bottom line

**This zip already contains the core lifecycle implementation.**  
What remains is a **cleanup + hardening pass** (one tight patch) plus a **single env checklist** so you stop getting “proxy_fetch_failed” from window-to-window confusion.

