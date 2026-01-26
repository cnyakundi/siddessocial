# Observability (Production Debugging, Privacy‑First)

This is the **main entry point** for Siddes observability.

If you are a beginner, start here:
- Open **`docs/OBS_PACK_INDEX.md`** and follow the read order.
- Pin **`docs/ONCALL_HOME.md`** for real incidents.

---

## What Siddes already gives you (baseline)

### Backend (Django)
- Every `/api/*` response includes `X-Request-ID`.
- Requests to `/api/*` emit JSON-line logs via `siddes.api` logger:
  - `event`, `request_id`, `viewer`, `method`, `path`, `status`, `latency_ms`, `side`
- Write guard exists in production to block unauthenticated writes (default allowlist is `/api/auth/*`).

### Frontend (Next.js)
- Core routes include `error.tsx` boundaries to show calm failure + retry:
  - Feed, Post detail, Sets, Invites, Inbox
- The `/api` proxy generates/forwards `x-request-id` and often injects `requestId` into JSON responses.

---

## The 5‑minute questions (the whole purpose)

In 5 minutes, oncall must be able to answer:
- Are 5xx errors spiking? Which endpoint(s)? Which service (Vercel vs Django vs Cloudflare edge)?
- Is p95 latency spiking? Which endpoint(s)?
- Are auth failures (401/403) spiking on write endpoints (cookie/CSRF/origin drift)?
- Are media failures happening (sign‑upload/commit) and/or `/m/*` failing at the edge?
- Is inbox failing (note: inbox is currently a Next stub, so it’s Vercel logs, not Django logs)?

---

## Privacy‑first logging rules (non‑negotiable)

### Required stored fields (canonical)
Store only request metadata needed for debugging:
- `request_id`, `route` (templated), `method`, `status`, `latency_ms`, `side`
- plus operational tags: `service`, `env`, `release`, `client_version` (if available)

### NEVER store (PII / secrets / content)
- passwords, OTPs, session cookies, auth/refresh tokens, `Authorization`
- email/phone/username/name
- post bodies, comments, inbox/DM text, bios, search queries
- signed media URLs, media keys, raw IP addresses

### Mandatory ingestion transforms (no code changes)
1) **Hash or drop** `viewer` (do not index/store raw `me_123`)
2) **Drop/redact** `query`
3) Convert dynamic paths → **templated `route`** (cardinality control), e.g.:
   - `/api/post/:post_id/like`
   - `/api/inbox/thread/:thread_id`
   - `/m/:key`

Policy docs:
- `docs/OBSERVABILITY_RETENTION_ACCESS_POLICY.md`
- `docs/OBSERVABILITY_PRIVACY_AUDIT_CHECKLIST.md`

---

## Event taxonomy (minimal)

Server/edge:
- `api.request` (Django request logs; derived from `event="api_request"`)
- `next.request` (Vercel runtime logs for Next route handlers — required for Inbox)
- `media.edge_request` (Cloudflare `/m/*` logs)

Client (optional, log‑only lane):
- `client.error.boundary`
- `client.net.request_failed`
- `client.media.put_failed`

---

## Datadog setup + dashboards + alerts (copy/paste)

### ClickOps implementation
- `docs/OBSERVABILITY_CLICKOPS_DATADOG.md`

### Dashboards & monitors pack
- `docs/OBSERVABILITY_DATADOG_DASHBOARDS_ALERTS.md`

### SLOs + burn‑rate alerts (smarter paging)
- `docs/OBSERVABILITY_SLOS_V0.md`
- `docs/OBSERVABILITY_BURN_RATE_ALERTS.md`

---

## How to debug a user report in 60 seconds (Support Code workflow)

**Always ask for Request ID** (`X-Request-ID` / `requestId`).
Then search:
- Datadog Logs: `@event:api_request @request_id:<PASTE>`

Use:
- `docs/OBSERVABILITY_SUPPORT_CODE_WORKFLOW.md`
- `docs/SUPPORT_RESPONSE_MACROS.md`

Incident notes:
- `docs/INCIDENT_TEMPLATE.md`

---

## Readiness gates + drills (make sure it works)

### Before every prod deploy (do not deploy blind)
- `docs/OBSERVABILITY_LAUNCH_GATE.md`
- `scripts/go_live_observability_gate.sh`

### Fire drill (prove request_id + route templating)
- `docs/OBSERVABILITY_FIRE_DRILL.md`
- `scripts/obs/fire_drill.sh`

### Incident drills (practice real scenarios)
- `docs/OBSERVABILITY_INCIDENT_DRILLS.md`
- `scripts/obs/incident_drills.sh`

---

## “What am I seeing?” and “What do I fix first?”
- `docs/OBSERVABILITY_KNOWN_FAILURE_SIGNATURES.md`
- `docs/OBSERVABILITY_FIX_PLAYBOOK_MAP.md`

---

## Rebuild everything anytime
- `docs/OBSERVABILITY_MASTER_CHECKLIST.md`

---

If you only pin ONE doc for incidents:
- `docs/ONCALL_HOME.md`
