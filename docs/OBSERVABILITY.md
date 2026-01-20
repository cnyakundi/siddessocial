# Observability Baseline

This doc defines the minimum “launch-grade” observability for Siddes.

## Backend (Django)

- Every `/api/*` response includes `X-Request-ID`.
- Requests to `/api/*` emit JSON-line logs via `siddes.api` logger:
  - `event`, `request_id`, `viewer`, `method`, `path`, `status`, `latency_ms`, `side`

## Frontend (Next.js)

- Core routes include `error.tsx` boundaries to show calm failure + retry:
  - Feed, Post detail, Sets, Invites, Inbox

## Why this matters

- Debugging production issues requires stitching together client + server events.
- Calm failures prevent user anxiety and reduce rage-quits.
