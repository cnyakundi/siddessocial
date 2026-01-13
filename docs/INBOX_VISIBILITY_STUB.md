# Inbox backend-stub visibility shim

This doc describes the deterministic visibility policy used in dev/stub mode.

It is enforced by:
- Next.js inbox fallback API stubs
- Django DRF Inbox API (memory + db store modes)

Canonical mappings live in:
- `frontend/src/lib/server/inboxVisibility.ts`
- `backend/siddes_inbox/visibility_stub.py`

## Inputs
A request can provide viewer identity via (first match wins):
1) header `x-sd-viewer`
2) cookie `sd_viewer`

The Next.js stub routes intentionally ignore any `?viewer=` query param (keep viewer identity out of URLs).

Production safety: when `NODE_ENV=production`, the Next.js stub viewer is disabled (viewerId=null) so the stubs return `restricted: true`. Real auth lives in the Django DRF backend.

If **no viewer is provided**, the API treats the viewer as **unknown** and returns `restricted: true`.

Notes:
- The Django DRF backend intentionally **ignores** `?viewer=`. Keep viewer identity out of URLs.
- In dev, if a viewer *is* provided but does not match a known role, it is normalized to `anon`.

DRF note:
- In dev, the DRF Inbox API **normalizes** `x-sd-viewer` / `sd_viewer` into these roles before applying policy.
  This prevents arbitrary viewer strings from bypassing Close/Work rules.


## Role mapping (deterministic)
We map viewer strings to roles:

| viewer string | role |
|---|---|
| `me`, `me_*` | `me` |
| `friends`, `friend`, `fr_*` | `friends` |
| `close`, `cl_*` | `close` |
| `work`, `coworker`, `wk_*` | `work` |
| anything else | `anon` |

Missing/empty viewer is **not** mapped to a role — it stays unknown and yields `restricted: true`.

## Allowed sides by role
| role | allowed sides |
|---|---|
| anon | public |
| friends | public, friends |
| close | public, friends, close |
| work | public, work |
| me | public, friends, close, work |

## Test vectors
These are deterministic expectations:

- viewer missing
  - list threads: restricted=true, items=[]
  - get thread: restricted=true

- viewer=anon
  - list threads: includes only threads locked to public
  - get thread locked to close: restricted=true, no messages

- viewer=friends
  - list threads: includes public + friends
  - setLockedSide to close: restricted=true

- viewer=close
  - list threads: includes public + friends + close

- viewer=work
  - list threads: includes public + work

- viewer=me
  - list threads: includes all
  - setLockedSide to any side: allowed

This shim is deliberately simple: it’s only here to prevent accidental leaks in stub mode and to let you test UX flows.
