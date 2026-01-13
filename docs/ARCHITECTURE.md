# Architecture Overview
**Updated:** 2026-01-09

## Frontend
- Next.js + TS + Tailwind
- Core components: SideBadge, SideSwitcherSheet, PostCard, SignalsSheet, EchoSheet, PeekSheet, ProfileView, ImportSheet

## Backend
- Django + API
- Side enforcement is server-side

## Minimal models (v0)
- User
- UserIdentity (HMAC token)
- Relationship (friends/close/work)
- Set + SetMember (Friends)
- Post (side_id + optional set_id)
- Interaction (like/echo/reply)
- SignalsCounter (cached)
- Notification (glimpse payload)
- LastSeen (per side)

## Key endpoints (starter)
- POST /api/contacts/match
- GET /api/feed?side=<id>&set=<optional>
- POST /api/posts
- POST /api/interactions (like/echo/reply)
- GET /api/notifications
- POST /api/composer/intent (later; can be client-side v0)
