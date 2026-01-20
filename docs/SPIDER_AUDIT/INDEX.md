# Spider-Audit System Maps (Siddes)

This folder contains the **Structural Mapping (Phase 1)** and the **Phase 2 Spider Packs** that were generated from the canonical Siddes source-of-truth ZIP.

## What’s here

### Phase 1 — Structural Mapping
- `PHASE1_COMPONENT_REGISTRY.md` — full Table-of-Contents style registry for Frontend + Backend + Assets.

### Phase 2 — Spider Packs
- `PHASE2_NOTIFICATIONS_SPIDERPACK.md` — Notifications/Alerts (UI surfaces → proxy → DB model + producers).
- PHASE2_SETS_SPIDERPACK.md - Sets subsystem (membership, events/history, create/update/delete, UI wiring, coupling points).
- PHASE2_VISIBILITY_POLICY_SPIDERPACK.md - Visibility & privacy enforcement (who can see what, where).
- `PHASE2_POSTS_PIPELINE_SPIDERPACK.md` — Posts pipeline (compose → create → feed → detail → replies/likes/echo/edit/delete/media).
- `PHASE2_CHAMELEON_SPIDERPACK.md` — Side state + Chameleon theme plumbing (tokens, providers, switching surfaces).
- `PHASE2_AUTH_SESSIONS_SPIDERPACK.md` — Auth + sessions plumbing (Frontend guards → Next API proxy → Django endpoints).

### Machine-readable indexes
- `indexes/component_registry.json`
- `indexes/frontend_app_registry.json`
- `indexes/next_route_handlers.json`
- `indexes/backend_api_registry_detailed.json`

## How to use
1. Start with `PHASE1_COMPONENT_REGISTRY.md` to pick a Level-2 building block.
2. Jump into the matching Phase 2 Spider Pack.
3. Continue expanding Spider Packs block-by-block (Posts, Visibility policy, Sets, Inbox, Safety, Notifications, Broadcasts, Search, Media, Telemetry).


- `PHASE2_INBOX_SPIDERPACK.md` - Inbox (threads → thread detail → send/move/unread/pins + store).

- `PHASE2_BROADCASTS_SPIDERPACK.md` - Broadcasts (Public desks: follow/unfollow, feed, hub, compose, writers, unread/seen, notify).

- `PHASE2_SEARCH_PRISM_SPIDERPACK.md` - Search + Prism (Discovery + identity facets).

-  - Slate (Public profile guestbook entries; DB-backed read endpoint).

- `PHASE2_MEDIA_SPIDERPACK.md` - Media (R2 attachments + /m serving).
