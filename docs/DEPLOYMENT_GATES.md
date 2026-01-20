# Deployment Gates

This is the **launch-readiness checklist** for Siddes. It’s written to be executable:
each gate has a **Definition of Done** and **Evidence commands** you can run.

## Severity levels

- **P0 = launch blocker** (do not deploy publicly without it)
- **P1 = strongly recommended** (shipable without, but you will feel pain)
- **P2 = nice-to-have** (post‑launch)

## Current known green items (from recent work)

- ✅ **Request IDs + structured API logs** baseline (sd_158)
- ✅ **Calm route error boundaries** for core screens (sd_158)
- ✅ **Deterministic DB seed scaffold** (“demo universe”) (sd_157)
- ✅ **Stub viewer cookie gated (dev-only)** (sd_153)

---

# P0 Gates

## P0.1 Authentication & sessions (Identity)

**Goal:** every request has a real viewer identity; no public deployment uses `sd_viewer` stubs.

**Definition of Done**
- Users can **sign up**, **sign in**, **sign out**
- Session is **server‑trusted** (cookie session or JWT + refresh)
- Password reset + email verification (or passwordless equivalent)
- Rate limits on auth endpoints (login/signup/reset)
- Stub viewer cookie is **disabled in production** and not needed for private sides

**Evidence commands**
- `./scripts/run_tests.sh`
- Manual:
  - create account → login → open `/siddes-feed` (friends/close/work require auth)
  - logout → friends/close/work routes deny or redirect
- API smoke:
  - `curl -i -X POST /api/auth/login ...` (or your chosen endpoint)
  - verify session cookie + authenticated `/api/*` requests

**Notes**
- Keep auth surface minimal for v1: email+password or passwordless link.
- Anything else (OAuth, 2FA) can be P1/P2.

---

## P0.2 Authorization & privacy enforcement (Siddes core)

**Goal:** server enforces Side + Set rules. Client never decides privacy.

**Definition of Done**
- Every core endpoint checks viewer identity and enforces:
  - Side visibility rules (Public vs Friends/Close/Work)
  - Set membership rules
  - Invite acceptance binding (side+set), expiry/uses
  - Siders/Siding lists: **viewer sees mutuals only** by default
- Deny‑by‑default: unknown viewer gets no private data
- No “same-origin stub leak” in production mode

**Evidence commands**
- `./verify_overlays.sh`
- Run smoke scripts (if present):
  - `bash scripts/dev/posts_drf_smoke.sh`
  - `bash scripts/dev/posts_db_persistence_smoke.sh`
- Manual checks:
  - open a friends post as unauthenticated viewer → denied/guarded
  - attempt cross-side operations → calmly guarded, not 500s

---

## P0.3 Production config hardening

**Goal:** safe Django/Next config.

**Definition of Done**
- `DEBUG=False` in production
- Correct `ALLOWED_HOSTS`
- CSRF/CORS configured safely (no wildcard in prod)
- Secure cookies (Secure + SameSite + HttpOnly where applicable)
- Secrets are injected (not committed)

**Evidence commands**
- `python manage.py check --deploy`
- confirm environment variables wired in deployment system (no `.env` in image)

---

## P0.4 Database safety (migrations, backups, indexes)

**Goal:** deploy without losing data or melting under load.

**Definition of Done**
- Migrations run automatically and safely in deploy pipeline
- Automated backups + tested restore process
- Basic indexes for feed and inbox queries (at least):
  - posts: `(side, created_at)` or equivalent
  - replies: `(post_id, created_at)`
  - inbox: viewer/thread indexes
- DB connection pooling or sane limits

**Evidence commands**
- `docker compose ... backend python manage.py migrate --check`
- backup restore drill (documented steps)

---

## P0.5 Abuse control & rate limiting

**Goal:** prevent spam, invite abuse, brute-force.

**Definition of Done**
- Rate limit: signup/login/reset, post create, message send, invite create
- Invite creation caps per viewer per day
- Post frequency limits (especially Public)
- “Kill switch” flags for risky surfaces (invites, public posting)

**Evidence commands**
- demonstrate rate limit responses (429) under repeated calls
- logs show blocked events with request_id

---

## P0.6 Observability & incident response minimum

**Goal:** you can debug production incidents quickly.

**Definition of Done**
- Request IDs propagate: client → Next → Django (`X-Request-ID`)
- Structured logs exist for `/api/*` (request_id, viewer, status, latency)
- Health & readiness endpoints
- Alerts on: 5xx rate, latency spikes, DB errors

**Evidence commands**
- `curl -I /api/feed?side=public` and verify `X-Request-ID`
- logs show JSON lines for each API request
- uptime monitor hits `/api/health` (or `/healthz`)

---

# P1 Gates (strongly recommended)

## P1.1 Moderation / Admin minimum
- User lookup + suspend/ban
- Post takedown/quarantine (Public)
- Invite revocation
- Audit log for admin actions

## P1.2 Media pipeline (Cloudflare or equivalent)
- Direct upload (signed) + metadata stored in DB
- Content-type validation + size limits
- Side-based share restrictions enforced server-side
- Autoplay rules (Public-only) enforced in UI

## P1.3 CI/CD + rollbacks
- CI runs: backend tests + frontend build + lint + overlay checks
- One-step rollback plan
- “Forward-only migrations” policy documented

## P1.4 Performance basics
- Pagination everywhere (feed, replies, inbox)
- Basic caching strategy (safe, Side-aware)
- Background jobs for heavy tasks (emails, notifications, media processing)

---

# P2 Gates (post-launch)

- 2FA
- OAuth providers
- Push notifications
- Full search/discover
- Full Side Personas editor (if not shipped in v1)
- Analytics pipeline (privacy-preserving)

---

# Start Plan (what to do first)

1) **Pick Auth approach** (email+password vs passwordless) and commit it in docs.
2) Implement **P0.1 Auth** → then enforce **P0.2 Authorization** across all endpoints.
3) Lock **P0.3–P0.6** (deploy hardening, DB safety, abuse controls, observability).
4) Only then: media pipeline + moderation (P1).

If you want a “military-grade” launch, treat P0 as non‑negotiable.
