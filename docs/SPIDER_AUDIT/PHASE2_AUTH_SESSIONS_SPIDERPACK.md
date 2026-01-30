# Phase 2.2 — Auth & Sessions Spider Pack (Siddes)

**Scope:** Authentication lifecycle + sessions/devices + CSRF + guardrails across **Frontend → Next API Proxy → Django/DRF**.

**Operating mode:** Structural + data-contract mapping only (no fixes, no refactors).

---

## 1) Auth “DNA” (what Siddes is, structurally)
Siddes uses **cookie-based Django session auth** as the production truth, with a **dev-only viewer stub** (`x-sd-viewer` / `sd_viewer`) that is explicitly blocked from `/api/auth/*` and disabled in production.

### 1.1 The canonical request path (browser → backend)
1) Browser calls **Next API** under `/api/auth/*` (same-origin with the frontend).
2) Next **proxies** the request to Django at `/api/auth/*`, forwarding:
   - `cookie` (session + csrf cookies)
   - `x-csrftoken` (for unsafe methods)
   - `x-request-id` (correlation)
   - dev-only: `x-sd-viewer` (non-production only)
3) Django authenticates via **SessionAuthentication**, writes via **CSRF** middleware in prod.
4) Django sets cookies (notably `sessionid`) → Next forwards `set-cookie` back to the browser.

**Proxy core:** `frontend/src/app/api/auth/_proxy.ts`

---

## 2) Frontend building blocks (auth surfaces + state dependencies)

### 2.1 Global auth guardrails
- **AuthBootstrap** — installs CSRF fetch patch + performs protected-route redirects using `/api/auth/me`.
  - **State deps:** `usePathname`, `useEffect` (plus fetch patch side-effect)
  - **Path:** `frontend/src/components/AuthBootstrap.tsx`
- **CSRF fetch patch** — patches `window.fetch` so unsafe `/api/*` calls include `x-csrftoken`.
  - **State deps:** none (module-level; patches at runtime)
  - **Path:** `frontend/src/lib/csrf.ts`
- **/api/auth/csrf** — Next route that sets `csrftoken` cookie if missing.
  - **Path:** `frontend/src/app/api/auth/csrf/route.ts`
- **fetchMe()** — small client helper for `/api/auth/me`.
  - **Path:** `frontend/src/lib/authMe.ts`

### 2.2 Auth entry pages (public)
- **LoginPage** — calls `/api/auth/login` and optionally `/api/auth/google`; validates `next` redirect as same-site.
  - **State deps:** `useState`, `useEffect`
  - **Path:** `frontend/src/app/login/page.tsx`
- **SignupPage** — calls `/api/auth/signup` and optionally `/api/auth/google`.
  - **State deps:** `useState`, `useEffect`
  - **Path:** `frontend/src/app/signup/page.tsx`
- **OnboardingPage** — calls `/api/auth/me`, `/api/auth/age/confirm`, `/api/auth/region`, `/api/auth/onboarding/complete`.
  - **State deps:** heavy (stateful wizard; includes side intelligence + suggestions)
  - **Path:** `frontend/src/app/onboarding/page.tsx`

### 2.3 Recovery / confirmation pages (public)
- **ForgotPasswordPage** — calls `/api/auth/password/reset/request`.
  - **State deps:** `useState`
  - **Path:** `frontend/src/app/forgot-password/page.tsx`
- **ResetPasswordPage** — reads `token` query param; calls `/api/auth/password/reset/confirm`.
  - **State deps:** `useSearchParams`, `useState`
  - **Path:** `frontend/src/app/reset-password/page.tsx`
- **VerifyEmailPage** — reads `token`; calls `/api/auth/verify/confirm`.
  - **State deps:** `useSearchParams`, `useEffect`, `useState`
  - **Path:** `frontend/src/app/verify-email/page.tsx`
- **ConfirmEmailChangePage** — reads `token`; calls `/api/auth/email/change/confirm`.
  - **State deps:** `useSearchParams`, `useState`
  - **Path:** `frontend/src/app/confirm-email-change/page.tsx`
- **ConfirmDeletePage** — reads `token`; calls `/api/auth/account/delete/confirm`.
  - **State deps:** `useSearchParams`, `useState`
  - **Path:** `frontend/src/app/confirm-delete/page.tsx`

### 2.4 Account management (protected)
- **AccountHome** — shows session + onboarding status; calls `/api/auth/me`, `/api/auth/logout`.
  - **State deps:** `useEffect`, `useState`
  - **Path:** `frontend/src/app/siddes-profile/account/page.tsx`
- **Password page** — calls `/api/auth/password/change`.
  - **State deps:** `useEffect`, `useState`
  - **Path:** `frontend/src/app/siddes-profile/account/password/page.tsx`
- **Email page** — calls `/api/auth/email/change/request`.
  - **State deps:** `useEffect`, `useState`
  - **Path:** `frontend/src/app/siddes-profile/account/email/page.tsx`
- **Sessions page** — calls `/api/auth/sessions`, `/api/auth/sessions/revoke`, `/api/auth/sessions/logout_all`.
  - **State deps:** `useEffect`, `useState`, `useMemo`
  - **Path:** `frontend/src/app/siddes-profile/account/sessions/page.tsx`
- **Export page** — calls `/api/auth/export`.
  - **State deps:** `useEffect`, `useState`
  - **Path:** `frontend/src/app/siddes-profile/account/export/page.tsx`
- **Danger zone** — calls `/api/auth/account/deactivate` and `/api/auth/account/delete/request`.
  - **State deps:** `useEffect`, `useState`
  - **Path:** `frontend/src/app/siddes-profile/account/danger/page.tsx`

### 2.5 Settings surfaces that touch auth-locality
- **Locality settings** — uses `/api/auth/me`, `/api/auth/region`, `/api/auth/age/confirm`.
  - **State deps:** `useEffect`, `useState`, `useMemo`
  - **Path:** `frontend/src/app/siddes-settings/locality/page.tsx`

### 2.6 Components that “hook” into auth state
- **DesktopUserMenu** — logout button calls `/api/auth/logout`.
  - **State deps:** `useEffect`
  - **Path:** `frontend/src/components/DesktopUserMenu.tsx`
- **SuggestedCirclesTray** — reads `/api/auth/me` to compute viewer key.
  - **State deps:** `useEffect`, `useState`, `useMemo`, `useRef`
  - **Path:** `frontend/src/components/SuggestedCirclesTray.tsx`
- **StubViewerCookie (dev-only)** — optionally sets `sd_viewer` cookie.
  - **State deps:** `useEffect`
  - **Path:** `frontend/src/components/StubViewerCookie.tsx`

---

## 3) Next API auth layer (route handlers + proxy contract)

### 3.1 Proxy core
- **proxyJson()** — forwards cookie + CSRF + request-id; resolves backend origin; returns `{res,data,setCookies}`.
  - **Path:** `frontend/src/app/api/auth/_proxy.ts`

### 3.2 Auth route handlers (full list)
Each handler is a thin wrapper around `proxyJson(req, "<backend_path>", <method>, <body>)` and forwards `set-cookie`.

- `/api/auth/me` → **GET** → `/api/auth/me`  
  `frontend/src/app/api/auth/me/route.ts`
- `/api/auth/login` → **POST** → `/api/auth/login`  
  `frontend/src/app/api/auth/login/route.ts`
- `/api/auth/signup` → **POST** → `/api/auth/signup`  
  `frontend/src/app/api/auth/signup/route.ts`
- `/api/auth/logout` → **POST** → `/api/auth/logout`  
  `frontend/src/app/api/auth/logout/route.ts`
- `/api/auth/google` → **POST** → `/api/auth/google`  
  `frontend/src/app/api/auth/google/route.ts`

- `/api/auth/onboarding/complete` → **POST** → `/api/auth/onboarding/complete`  
  `frontend/src/app/api/auth/onboarding/complete/route.ts`
- `/api/auth/region` → **GET/POST** → `/api/auth/region`  
  `frontend/src/app/api/auth/region/route.ts`
- `/api/auth/age/confirm` → **POST** → `/api/auth/age/confirm`  
  `frontend/src/app/api/auth/age/confirm/route.ts`

- `/api/auth/password/reset/request` → **POST** → `/api/auth/password/reset/request`  
  `frontend/src/app/api/auth/password/reset/request/route.ts`
- `/api/auth/password/reset/confirm` → **POST** → `/api/auth/password/reset/confirm`  
  `frontend/src/app/api/auth/password/reset/confirm/route.ts`
- `/api/auth/password/change` → **POST** → `/api/auth/password/change`  
  `frontend/src/app/api/auth/password/change/route.ts`

- `/api/auth/verify/confirm` → **POST** → `/api/auth/verify/confirm`  
  `frontend/src/app/api/auth/verify/confirm/route.ts`
- `/api/auth/verify/resend` → **POST** → `/api/auth/verify/resend`  
  `frontend/src/app/api/auth/verify/resend/route.ts`

- `/api/auth/sessions` → **GET** → `/api/auth/sessions`  
  `frontend/src/app/api/auth/sessions/route.ts`
- `/api/auth/sessions/revoke` → **POST** → `/api/auth/sessions/revoke`  
  `frontend/src/app/api/auth/sessions/revoke/route.ts`
- `/api/auth/sessions/logout_all` → **POST** → `/api/auth/sessions/logout_all`  
  `frontend/src/app/api/auth/sessions/logout_all/route.ts`

- `/api/auth/email/change/request` → **POST** → `/api/auth/email/change/request`  
  `frontend/src/app/api/auth/email/change/request/route.ts`
- `/api/auth/email/change/confirm` → **POST** → `/api/auth/email/change/confirm`  
  `frontend/src/app/api/auth/email/change/confirm/route.ts`

- `/api/auth/account/deactivate` → **POST** → `/api/auth/account/deactivate`  
  `frontend/src/app/api/auth/account/deactivate/route.ts`
- `/api/auth/account/delete/request` → **POST** → `/api/auth/account/delete/request`  
  `frontend/src/app/api/auth/account/delete/request/route.ts`
- `/api/auth/account/delete/confirm` → **POST** → `/api/auth/account/delete/confirm`  
  `frontend/src/app/api/auth/account/delete/confirm/route.ts`

- `/api/auth/export` → **GET** → `/api/auth/export?limit=...`  
  `frontend/src/app/api/auth/export/route.ts`

---

## 4) Backend building blocks (Django/DRF)

### 4.1 Primary URLConf
- **Auth URL routing** — mounts 22 auth endpoints.
  - **Path:** `backend/siddes_auth/urls.py`

### 4.2 Auth endpoints (controllers)
- **views.py** — Signup/Login/Logout/Me/Google auth + onboarding + locality + age gate.
  - **Path:** `backend/siddes_auth/views.py`
- **email_verification.py** — verification token generation, confirm, resend.
  - **Path:** `backend/siddes_auth/email_verification.py`
- **password_reset.py** — reset request + confirm + password change.
  - **Path:** `backend/siddes_auth/password_reset.py`
- **account_lifecycle.py** — email change + deactivate + delete + export.
  - **Path:** `backend/siddes_auth/account_lifecycle.py`
- **sessions.py** — list/revoke/logout-all across tracked sessions.
  - **Path:** `backend/siddes_auth/sessions.py`

### 4.3 Data models (auth state)
- **SiddesProfile** — onboarding status, locality, age gate, email verification, account_state.
- **EmailVerificationToken / PasswordResetToken / EmailChangeToken / AccountDeleteToken** — hashed, expiring, single-use tokens.
- **UserSession** — tracked sessions/devices.
  - **Path:** `backend/siddes_auth/models.py`

### 4.4 Middleware + enforcement related to auth
- **UserSessionCaptureMiddleware** — records session usage + logs out revoked sessions.
  - **Path:** `backend/siddes_auth/middleware.py`
- **CSRF dev exemption helper** — only exempts when `DEBUG=True`.
  - **Path:** `backend/siddes_backend/csrf.py`
- **DRF dev viewer auth** — DEV-only viewer identity; excluded from `/api/auth/*`.
  - **Path:** `backend/siddes_backend/drf_auth.py`
- **RequestIdMiddleware** — attaches `X-Request-ID`.
  - **Path:** `backend/siddes_backend/middleware.py`
- **ApiWriteAuthGuardMiddleware** — safety net for write methods; allowlists `/api/auth/` by default.
  - **Path:** `backend/siddes_backend/middleware.py`
- **AccountStateMiddleware** — blocks unsafe writes for suspended/read_only/banned accounts.
  - **Path:** `backend/siddes_backend/middleware.py`
- **PanicModeMiddleware** — global write freeze kill-switch.
  - **Path:** `backend/siddes_backend/middleware.py`
- **Throttles** — login + scoped throttling.
  - **Path:** `backend/siddes_backend/throttles.py`

### 4.5 Backend configuration touchpoints
- **REST_FRAMEWORK auth stack** — includes `DevHeaderViewerAuthentication` + `SessionAuthentication`.
- **Cookie + CSRF settings** — SameSite + Secure in prod; CSRF_TRUSTED_ORIGINS for local Next.
- **Middleware order** — SessionMiddleware → CsrfViewMiddleware → AuthenticationMiddleware → UserSessionCaptureMiddleware → enforcement middleware.
  - **Path:** `backend/siddes_backend/settings.py`

---

## 5) Data contracts (request/response truth)

> Naming notes:
> - Cookie auth relies on `sessionid` (default Django cookie name; not overridden in settings).
> - CSRF cookie is `csrftoken`.
> - Viewer id convention returned by backend: `viewerId: "me_<user.id>"`.

### 5.1 Core session introspection
**GET `/api/auth/me`**
- **Unauthed response:** `{ ok: true, authenticated: false }`
- **Authed response:**
  ```json
  {
    "ok": true,
    "authenticated": true,
    "user": {"id": 1, "username": "name", "email": "e@x.com"},
    "viewerId": "me_1",
    "emailVerified": true,
    "ageGateConfirmed": true,
    "minAge": 13,
    "locality": {"detectedRegion": "KE", "chosenRegion": "", "region": "KE"},
    "onboarding": {"completed": true, "step": "done", "contact_sync_done": true}
  }
  ```

### 5.2 Signup / login / logout
**POST `/api/auth/signup`** body:
```json
{ "email": "...", "username": "...", "password": "...", "ageConfirmed": true }
```
Response mirrors Login (below) + `isStaff` and `locality`.

**POST `/api/auth/login`** body:
```json
{ "identifier": "email_or_username", "password": "..." }
```
Response:
```json
{ "ok": true, "user": {...}, "viewerId": "me_#", "emailVerified": false, "ageGateConfirmed": false, "minAge": 13, "locality": {...}, "isStaff": false, "onboarding": {...} }
```

**POST `/api/auth/logout`** response:
```json
{ "ok": true }
```

### 5.3 Google auth
**POST `/api/auth/google`** body:
```json
{ "credential": "<google id token>" }
```
Response: same envelope as login plus `{ created: boolean }`.

### 5.4 Onboarding completion
**POST `/api/auth/onboarding/complete`** body:
```json
{ "contact_sync_done": true }
```
Response:
```json
{ "ok": true, "onboarding": {"completed": true, "step": "done", "contact_sync_done": true} }
```

### 5.5 Locality + age gate
**GET `/api/auth/region`** → `{ ok: true, locality: {detectedRegion, chosenRegion, region} }`

**POST `/api/auth/region`** body:
```json
{ "region": "KE" }
```
(or `""` to clear chosen region)

**POST `/api/auth/age/confirm`** body:
```json
{ "confirmed": true }
```
Response:
```json
{ "ok": true, "ageGateConfirmed": true, "minAge": 13 }
```

### 5.6 Email verification
**POST `/api/auth/verify/confirm`** body:
```json
{ "token": "..." }
```
Response:
```json
{ "ok": true, "verified": true, "user": {...}, "viewerId": "me_#", "emailVerified": true, "onboarding": {...} }
```

**POST `/api/auth/verify/resend`** response comes from `create_and_send_email_verification()`:
- success: `{ ok: true, sent: true, provider: "console|smtp|sendgrid" }`
- cooldown: `{ ok: true, sent: false, cooldownRemainingSec: <n> }`
- already verified: `{ ok: true, alreadyVerified: true, sent: false }`

### 5.7 Password reset + change
**POST `/api/auth/password/reset/request`** body:
```json
{ "identifier": "email_or_username" }
```
Response (always generic): `{ ok: true, queued: true }`

**POST `/api/auth/password/reset/confirm`** body:
```json
{ "token": "...", "password": "new_password" }
```
Response:
```json
{ "ok": true, "reset": true, "user": {...}, "viewerId": "me_#", "emailVerified": true, "onboarding": {...} }
```

**POST `/api/auth/password/change`** body:
```json
{ "oldPassword": "optional", "newPassword": "...", "logoutOtherSessions": false }
```
Response: `{ ok: true, changed: true }`

### 5.8 Sessions / devices
**GET `/api/auth/sessions`** response:
```json
{ "ok": true, "sessions": [ {"id": 1, "current": true, "createdAt": "...", "lastSeenAt": "...", "ip": "...", "userAgent": "...", "revokedAt": null } ] }
```

**POST `/api/auth/sessions/revoke`** body:
```json
{ "id": 1 }
```
Response:
- other session: `{ ok: true, revoked: true }`
- current session: `{ ok: true, revoked: true, loggedOut: true }`

**POST `/api/auth/sessions/logout_all`** body:
```json
{ "includeCurrent": false }
```
Response:
```json
{ "ok": true, "revoked": 3, "scannedDeleted": 0, "loggedOut": false }
```

### 5.9 Email change
**POST `/api/auth/email/change/request`** body:
```json
{ "newEmail": "...", "password": "optional" }
```
Response: `{ ok: true, sent: true }`

**POST `/api/auth/email/change/confirm`** body:
```json
{ "token": "..." }
```
Response includes a **session payload**:
```json
{ "ok": true, "confirmed": true, "user": {...}, "viewerId": "me_#", "emailVerified": true, "session": {"name":"sessionid","value":"<session_key>"} }
```

### 5.10 Account lifecycle
**POST `/api/auth/account/deactivate`** → `{ ok: true, deactivated: true }`

**POST `/api/auth/account/delete/request`** → `{ ok: true, sent: true }` (requires verified email)

**POST `/api/auth/account/delete/confirm`** body:
```json
{ "token": "..." }
```
Response: `{ ok: true, deleted: true }`

### 5.11 Export
**GET `/api/auth/export?limit=1000`** returns:
- `ok`, `exportedAt`, `user`, `profile`, `aliases`, plus arrays: `sets`, `posts`, `replies`, `blocks`, `mutes`, `reports`, `appeals`.

---

## 6) Guardrails map (where “no leakage” is enforced)

### 6.1 Frontend guardrails
- **Protected-route redirects** happen in `AuthBootstrap` via `/api/auth/me` and a fixed prefix list.
  - File: `frontend/src/components/AuthBootstrap.tsx`
- **Safe next redirect** on login: only same-site relative paths allowed.
  - File: `frontend/src/app/login/page.tsx`
- **CSRF attachment**: patched fetch adds `x-csrftoken` on unsafe `/api/*` calls.
  - File: `frontend/src/lib/csrf.ts`

### 6.2 Backend guardrails
- **CSRF enforcement in prod**: `dev_csrf_exempt` only exempts when `DEBUG=True`.
  - File: `backend/siddes_backend/csrf.py`
- **Dev viewer explicitly excluded from auth endpoints**:
  - File: `backend/siddes_backend/drf_auth.py`
- **Write safety net**: blocks unauthenticated writes to `/api/*` in prod, allowlists `/api/auth/`.
  - File: `backend/siddes_backend/middleware.py` (`ApiWriteAuthGuardMiddleware`)
- **Account state enforcement**: blocks unsafe writes for suspended/read_only/banned.
  - File: `backend/siddes_backend/middleware.py` (`AccountStateMiddleware`)
- **Session revocation enforcement**: revoked sessions auto-logout.
  - File: `backend/siddes_auth/middleware.py`

---

## 7) Third-party tissue (exact hook points)

### 7.1 Frontend
- **Next.js App Router + Route Handlers** — auth pages + `/api/auth/*` handlers.
  - Paths: `frontend/src/app/**`
- **Google Identity Services** (external script) — loaded in login/signup pages.
  - Path: `frontend/src/app/login/page.tsx`, `frontend/src/app/signup/page.tsx`

### 7.2 Backend
- **Django auth/session stack** — `authenticate/login/logout`, SessionMiddleware, AuthenticationMiddleware.
  - Path: `backend/siddes_auth/views.py`, `backend/siddes_backend/settings.py`
- **Django REST Framework** — APIView controllers + SessionAuthentication.
  - Paths: `backend/siddes_auth/*.py`, `backend/siddes_backend/settings.py`
- **google-auth** — verifies Google ID tokens.
  - Path: `backend/siddes_auth/views.py`
- **SMTP via Django EmailMultiAlternatives** — transactional email provider.
  - Path: `backend/siddes_backend/emailing.py`
- **SendGrid via requests** — optional provider.
  - Path: `backend/siddes_backend/emailing.py`
- **WhiteNoise** — static handling in backend middleware.
  - Path: `backend/siddes_backend/settings.py`

---

## 8) ToC format index (requested hierarchy)

### Frontend
- **AuthBootstrap** — protected-route redirects + CSRF patch install.  
  `frontend/src/components/AuthBootstrap.tsx`
- **CSRF patch** — attaches `x-csrftoken` to unsafe `/api/*` calls.  
  `frontend/src/lib/csrf.ts`
- **Auth entry pages** — login/signup + Google sign-in.  
  `frontend/src/app/login/page.tsx`, `frontend/src/app/signup/page.tsx`
- **Recovery/confirm pages** — reset password, verify email, confirm email change, confirm delete.  
  `frontend/src/app/reset-password/page.tsx`, `frontend/src/app/verify-email/page.tsx`, `frontend/src/app/confirm-email-change/page.tsx`, `frontend/src/app/confirm-delete/page.tsx`
- **Account management** — password/email/sessions/export/danger flows.  
  `frontend/src/app/siddes-profile/account/*/page.tsx`
- **Next auth proxy** — forwards cookies/CSRF/request-id to Django.  
  `frontend/src/app/api/auth/_proxy.ts`
- **Next auth route handlers** — thin wrappers to backend `/api/auth/*`.  
  `frontend/src/app/api/auth/**/route.ts`

### Backend
- **siddes_auth URLConf** — 22 auth endpoints.  
  `backend/siddes_auth/urls.py`
- **Auth controllers** — signup/login/me/google/onboarding/locality/age.  
  `backend/siddes_auth/views.py`
- **Email verification** — verify confirm + resend.  
  `backend/siddes_auth/email_verification.py`
- **Password reset/change** — reset request + confirm + change.  
  `backend/siddes_auth/password_reset.py`
- **Account lifecycle** — email change + deactivate + delete + export.  
  `backend/siddes_auth/account_lifecycle.py`
- **Sessions API** — list/revoke/logout_all.  
  `backend/siddes_auth/sessions.py`
- **Auth state models** — profile, tokens, tracked sessions.  
  `backend/siddes_auth/models.py`
- **Session capture middleware** — tracks devices + enforces revocation.  
  `backend/siddes_auth/middleware.py`
- **Backend enforcement middleware** — write guard + account state + panic mode + request ids.  
  `backend/siddes_backend/middleware.py`
- **Backend settings** — cookie/csrf + DRF auth stack + middleware order.  
  `backend/siddes_backend/settings.py`

### Assets
- **Brand mark used in auth pages** — login/signup UI image.  
  `frontend/public/brand/*`


