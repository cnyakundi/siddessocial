# Sets API stubs (Next.js)

These routes are **dev fallback stubs**. They exist so the frontend can evolve while the Django Sets backend is still being wired.

## Enable in frontend

Set the provider to use these stubs:

```bash
# ops/docker/.env
NEXT_PUBLIC_SETS_PROVIDER=backend_stub
```

Then restart Next.js. Writes require `sd_viewer=me` (cookie) in dev.


## Viewer gating (default-safe)
All routes are gated by:
- cookie: `sd_viewer`
- header: `x-sd-viewer`

Identity is resolved by `resolveStubViewer()` and **never** by query params (`?viewer=` is not accepted).

If the viewer is missing or not `me`, the routes return `restricted=true` and empty results (and reject writes).

## Routes

### `GET /api/sets?side=friends|close|work|public`
Returns the viewer's sets. If `side` is provided, results are filtered.

Response:
```json
{ "ok": true, "restricted": false, "items": [/* sets */] }
```

### `POST /api/sets`
Create one set:
```json
{ "side": "friends", "label": "Gym Squad", "members": ["@a", "@b"], "color": "orange" }
```

Or bulk create:
```json
{ "inputs": [ { "side": "friends", "label": "...", "members": [] } ] }
```

### `GET /api/sets/[id]`
Fetch a set by id.

### `PATCH /api/sets/[id]`
Update fields (any subset):
```json
{ "label": "New name", "members": ["@x"], "side": "friends", "color": "emerald" }
```

### `GET /api/sets/[id]/events`
Returns the event log for that set (created/renamed/members updated).
