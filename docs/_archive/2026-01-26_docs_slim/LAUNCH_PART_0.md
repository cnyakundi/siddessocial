# LAUNCH PART 0 — Global Launch Closure Plan ("Lunch part 0")

This document is the **starting blueprint** for turning Siddes into a platform that can safely handle a **global public launch**.

It is written to be **executed** in your workflow:
- Each fix ships as a **small overlay** with a **single apply-helper script** (`sd_###_*_apply_helper.sh`).
- Each overlay includes: **Definition of Done**, **Evidence commands**, and a **doc update**.
- We close P0 items first; P1 items become the immediate follow‑ups.

> Related docs: `docs/DEPLOYMENT_GATES.md`, `docs/LAUNCH_GATES.md`, `docs/THROTTLING.md`, `docs/OBSERVABILITY.md`, `docs/PRIVACY_SECURITY.md`.

---

## Guiding laws (non‑negotiables)

1) **No cross‑Side leakage.** Server enforces visibility; client never decides privacy.
2) **Production identity is session‑truth.** Dev viewer headers/cookies exist only when DEBUG/DEV.
3) **Deny-by-default.** If viewer can’t be identified/authorized, return `restricted: true` with no private data.
4) **Unfinished = hidden.** No mock/toast-only features in production.
5) **Operate like an airline.** Backups, restore drill, metrics, and rollbacks are part of the product.

---

## Launch modes (choose deliberately)

### Mode A — Closed Beta (recommended *today*)
- Invite-only (or allowlisted signups)
- Text-first (media optional later)
- Public posting is trust‑gated or off
- Manual moderation with Panic Mode ready

### Mode B — Open Beta (only after Part 0 P0s)
You do **not** open global signups until:
- Email verification + resend exists
- Password reset exists
- Username policy stops impersonation
- User suspend/ban enforcement exists
- Secure cookies are correct in prod

---

## Part 0 map (what we will build)

### P0 workstreams (launch blockers)
- **0.1 Email infrastructure** (transactional email foundation)
- **0.2 Email verification + resend**
- **0.3 Password reset + change password**
- **0.4 Username & identity policy** (reserved words, normalization, anti-impersonation)
- **0.5 Cookie/session hardening** (Secure/SameSite/HttpOnly correctness)
- **0.6 User safety state + enforcement** (limited/suspended/banned)
- **0.7 Admin cockpit: stats + user lookup** (operate the platform)
- **0.8 Legal / policy pack** (ToS/Privacy/Guidelines)

### P1 workstreams (strongly recommended right after)
- **1.1 Media pipeline MVP** (if you want mainstream growth)
- **1.2 Background jobs** (emails, notifications, media processing)
- **1.3 Search/discovery (privacy-safe)**
- **1.4 Device/session management** (logout everywhere, session list)
- **1.5 Account lifecycle** (change email, deactivate/delete, export data)

---

## Execution order (step-by-step)

**Step 1 — Make email real (0.1)**
- You can’t do verification/reset without deliverable email.

**Step 2 — Close account recovery (0.2 + 0.3)**
- Verification + resend
- Password reset
- Change password

**Step 3 — Stop impersonation (0.4)**
- Reserved usernames + normalization

**Step 4 — Fix production cookies (0.5)**
- Secure cookies in prod is not optional.

**Step 5 — Make moderation actually stop actors (0.6 + 0.7)**
- Suspend/ban/limited state enforced by the server
- Admin cockpit visibility

**Step 6 — Ship policy pages (0.8)**
- Minimum viable legal/policy pack linked in-app

**Step 7 — Preflight & release**
- Restore drill
- Abuse simulation
- Basic load test
- Rollback plan documented

---

# Workstream 0.1 — Email infrastructure (transactional)

## Goal
Reliable transactional email for:
- verification
- password reset
- security alerts (later)

## Scope
Backend:
- Email provider configuration via env vars
- A single `EmailService` adapter (so provider can change without code churn)
- Templates for verification/reset
- Logging: message id + request_id

Frontend:
- Basic “check your inbox” states
- Clear resend cooldown UX

Ops:
- Provider choice documented (SES/SendGrid/Postmark)
- Test command + staging verification

## Step-by-step implementation
1) Add env vars:
   - `SD_EMAIL_PROVIDER` (console|smtp|sendgrid|ses)
   - `SD_EMAIL_FROM`
   - provider credentials (secret)
2) Implement email adapter (`send_email(to, subject, text, html=None)`)
3) Add a **dev console backend** (emails print to logs) + staging/prod provider
4) Add `manage.py send_test_email you@example.com`
5) Add basic monitoring note: deliverability failures must be visible in logs

## Definition of Done
- Dev: reset/verify email prints to console logs
- Prod/Staging: `send_test_email` delivers successfully

## Evidence commands
- `backend: python manage.py send_test_email you@domain.com`
- Verify provider logs show message delivered

---

# Workstream 0.2 — Email verification + resend

## Goal
Prevent bot/spam accounts and ensure recovery channel is real.

## Scope
Backend:
- `POST /api/auth/verify/send` (or as part of signup)
- `POST /api/auth/verify/resend` (rate-limited + cooldown)
- `GET /api/auth/verify/confirm?token=...`
- Store verification token **hashed** and **single-use**

Frontend:
- After signup: “Verify your email” screen
- Resend button with cooldown + clear error messages

Abuse controls:
- Throttle resend by IP + by account
- Don’t leak whether an email exists

## Step-by-step implementation
1) Add fields: `email_verified`, `email_verified_at`
2) Create verification token model/table:
   - `user_id, token_hash, expires_at, used_at, created_at`
3) Signup flow:
   - create user → send verification email → return `needsVerification: true`
4) Verify confirm endpoint:
   - validate token → mark email verified → invalidate token
5) Resend endpoint:
   - enforce cooldown (e.g., 60s) + daily cap

## Definition of Done
- Unverified accounts cannot perform risky actions (Public posting, invites) unless you choose otherwise
- Verification email can be resent safely

## Evidence commands
- Create account → verify link → `GET /api/auth/me` shows verified
- Hammer resend endpoint → see 429 throttles

---

# Workstream 0.3 — Password reset + change password

## Goal
People will lose passwords on day 1. Without reset, you’ll drown.

## Scope
Backend:
- `POST /api/auth/password/reset/request` (does not leak existence)
- `POST /api/auth/password/reset/confirm` (token + new password)
- `POST /api/auth/password/change` (requires session)
- Reset tokens hashed, expiring, single-use

Frontend:
- Forgot password page
- Reset form page
- Change password in settings

Abuse controls:
- Rate limit reset requests by IP + email
- Lockout/backoff on repeated invalid token attempts

## Step-by-step implementation
1) Add reset token model/table (same pattern as verify)
2) Request endpoint:
   - always return 200 (“if account exists we emailed you”)
3) Confirm endpoint:
   - validate token → set password → invalidate all old sessions (or rotate)
4) Change password endpoint:
   - requires current password check + rate limit

## Definition of Done
- User can recover access via email
- Token replay is impossible

## Evidence commands
- Request reset → confirm reset → login succeeds
- Attempt reuse token → rejected

---

# Workstream 0.4 — Username & identity policy (anti-impersonation)

## Goal
Stop `admin/support/official` scams and prevent look‑alike usernames.

## v1 policy (recommended)
- Keep usernames **ASCII only** (simple + safe)
- Enforce **case-insensitive uniqueness**
- Block reserved/system words
- Block confusing patterns (`__`, leading/trailing `_`, etc.)

## Scope
Backend:
- Central `validate_username()` used by signup + rename
- Reserved list (`admin`, `support`, `security`, `moderation`, `siddes`, `official`, `verified`, etc.)
- Normalized field stored (e.g. `username_norm = lower(username)`)
- Unique constraint on `username_norm`

Frontend:
- Inline validation: show why username is rejected

## Step-by-step implementation
1) Add `username_norm` column + backfill migration
2) Enforce uniqueness on `username_norm`
3) Add reserved list and pattern rules
4) Ensure all lookups use normalization

## Definition of Done
- `John` and `john` cannot coexist
- `support`, `admin`, etc. are blocked

## Evidence commands
- Attempt signup with reserved username → rejected
- Attempt `John` then `john` → rejected

---

# Workstream 0.5 — Cookie & session hardening

## Goal
Make session cookies production-correct (Secure, SameSite, HttpOnly).

## Scope
Backend:
- Confirm Django session cookie settings (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SameSite`)

Frontend (Next proxy routes):
- When setting `sessionid` on Next domain, set:
  - `httpOnly: true`
  - `secure: true` in production
  - `sameSite: lax` (or `strict` if compatible)

## Step-by-step implementation
1) Define a shared helper `isProd()` used in Next route handlers
2) Ensure `resp.cookies.set(... secure: isProd)`
3) Add a small test check: in prod build, cookies must include Secure

## Definition of Done
- Production cookies are Secure
- No accidental dev-only identity in prod

## Evidence commands
- On HTTPS deployment: inspect Circle-Cookie headers → `Secure; HttpOnly; SameSite=Lax`

---

# Workstream 0.6 — User safety state + enforcement

## Goal
Mods must be able to stop bad actors immediately.

## Scope
Backend:
- Add user safety state:
  - `ACTIVE | LIMITED | SUSPENDED | BANNED`
  - optional `until` + `reason`
- Enforce state in write endpoints:
  - posts/replies/invites/messages

Admin:
- Staff endpoints to set safety state
- Audit log entries for every change

Frontend:
- User lookup panel + actions
- Calm error UI for limited/suspended users

## Step-by-step implementation
1) Add `safety_state`, `safety_until`, `safety_reason`
2) Add helper `require_active_viewer()` used by write endpoints
3) Add admin endpoints:
   - `POST /api/mod/users/:id/state`
4) Update moderation UI

## Definition of Done
- Suspended users cannot write anywhere
- Admin actions are logged

## Evidence commands
- Circle user to SUSPENDED → posting returns restricted
- Audit log shows actor + timestamp

---

# Workstream 0.7 — Admin cockpit: stats + operator visibility

## Goal
Operate production without guessing.

## Scope
Backend:
- Minimal stats endpoint:
  - signups/day, DAU, posts/day, reports/day
  - error counts (from logs is ok initially)
- Admin dashboard page

Ops:
- Define the 5 alerts you need on day 1:
  - 5xx spike
  - auth failures spike
  - latency spike
  - DB connection errors
  - email send failures

## Step-by-step implementation
1) Implement `/api/admin/stats` behind staff auth
2) Build `/moderation/ops` (or similar) panel
3) Add docs: where to look during incidents

## Definition of Done
- You can answer “what’s happening right now?” in 30 seconds

## Evidence commands
- Load admin ops page → shows live counts

---

# Workstream 0.8 — Legal / policy pack

## Goal
Minimum viable legal + community expectations for a global platform.

## Scope
Frontend:
- Routes/pages:
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/guidelines`
- Links in footer/settings

Policy content (starter):
- prohibited conduct
- privacy basics
- reporting and takedown process
- account termination policy

## Step-by-step implementation
1) Add pages with version/date header
2) Link them in app chrome
3) Add “Contact abuse” method (email or form)

## Definition of Done
- Pages load in production
- App links to them

---

# P1 follow-ups (after Part 0)

## 1.1 Media pipeline MVP
If you want mainstream adoption, you eventually need images/video. Don’t fake it.

MVP path:
- Images only first (no video)
- Signed direct upload (S3/R2) + DB metadata
- Thumbnails + EXIF strip
- Strict size/type limits

## 1.2 Background jobs
Use a worker for:
- email sending
- notifications
- media processing

## 1.3 Search/discovery (privacy-safe)
Start with:
- user lookup
- Public posts search
- topic search

## 1.4 Device/session management
- Session list per account
- Logout all devices
- Token/session rotation on password change

## 1.5 Account lifecycle
- Change email (verify new email)
- Deactivate / delete account (grace period)
- Export data (JSON/ZIP)

---

## Final preflight checklist (before opening global)

- ✅ Restore drill completed and documented
- ✅ Panic Mode tested
- ✅ Auth flows tested end-to-end
- ✅ Reserved usernames enforced
- ✅ Suspend/ban works and is audited
- ✅ Cookies Secure in prod
- ✅ Rate limits verified (429)
- ✅ Legal pages live

---

## How we will track progress

- Each workstream gets a short overlay series.
- After each overlay:
  - update `docs/STATE.md` (what changed)
  - update `docs/DEPLOYMENT_GATES.md` status if needed
  - include evidence commands in overlay README

When Part 0 P0 workstreams are green, we can safely flip from Closed Beta → Open Beta.
