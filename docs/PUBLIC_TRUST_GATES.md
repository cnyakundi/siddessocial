# Siddes — Public Trust Gates (sd_133)

> **Note:** UI says **Topics**. Implementation uses `publicChannel` internally (topics are an implementation detail).

**Goal:** Keep the Public Side usable without shipping a full moderation or reputation system yet.

These are **server-enforced** (in the Next.js API *stubs*) and **fully opt-in**.

> Important: These stubs are not production auth. In production (`NODE_ENV=production`), the stubs stay default-safe.

## What this enables
When enabled, Public writes (posts + replies) side a minimal capability model:

### 1) Trust required to write
- **Trust 0**: cannot write in Public (read-only)
- **Trust 1+**: can write in Public

### 2) Link gating
- Links (e.g. `https://…` or `www.…`) require **Trust 2+**

### 3) Simple rate limits (per viewer)
- **Trust 1**: 1 public write per ~60 seconds
- **Trust 2**: 1 public write per ~15 seconds
- **Trust 3**: effectively unlimited (dev)

This is intentionally simple and explainable.

## How to enable
In `ops/docker/.env` (or your dev env):

```bash
NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES=1
```

Restart Next after changing env vars.

## How trust is determined (dev stub)
The server reads trust from (in order):
1) Cookie: `sd_trust`
2) Header: `x-sd-trust`
3) Deterministic default based on `sd_viewer` role

Defaults (when no `sd_trust` is set):
- `sd_viewer=me` → Trust 3
- `sd_viewer=work|close` → Trust 2
- `sd_viewer=friends` → Trust 1
- `sd_viewer=anon` → Trust 0

To simulate a new/low-trust user in dev:

```js
document.cookie = "sd_trust=1; Path=/; SameSite=Lax";
```

To clear:

```js
document.cookie = "sd_trust=; Max-Age=0; Path=/";
```

## Where enforcement happens
- `frontend/src/app/api/post/route.ts` (new Public posts)
- `frontend/src/app/api/post/[id]/reply/route.ts` (new replies)

Implementation helpers:
- `frontend/src/lib/server/stubTrust.ts` (trust resolution)
- `frontend/src/lib/server/publicTrustGates.ts` (capabilities + rate limiting)

## Why this matters
Public is the highest-risk surface for spam and AI sludge.
These gates let us ship the **Public Topics + Trust Dial** UX without needing a full-blown moderation stack on day one.