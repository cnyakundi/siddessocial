# Siddes Search (sd_326)

Launch-safe v0 search:

- **People**: username/handle lookup
- **Posts**: **Public side only** (no private search at launch)
- **Profiles**: minimal public profile page at `/u/<username>`

## Backend endpoints

- `GET /api/search/users?q=<query>&limit=20`
  - Requires viewer/session (returns `{restricted:true}` when unauth)
  - Returns: `{ items: [{ id, username, handle, isStaff }] }`

- `GET /api/search/posts?q=<query>&limit=50`
  - Requires viewer/session
  - Public posts only, `is_hidden=false`
  - Returns items in **feed-compatible shape** (works with `PostCard`)

- `GET /api/users/<username>`
- `GET /api/users/<username>/posts?limit=50`

## Frontend

- `/search?q=...` with tabs: Posts / People
- `/u/<username>` public profile (public posts only)

## Safety notes

- No searching of non-public Sides in v0.
- No anonymous search in production (aligns with feed restricted behavior).
- Throttles:
  - `SIDDES_THROTTLE_SEARCH_USERS` (default 120/min)
  - `SIDDES_THROTTLE_SEARCH_POSTS` (default 60/min)
