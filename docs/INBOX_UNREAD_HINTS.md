# Inbox server unread hints (backend_stub)

Backend stub inbox threads endpoint returns a small deterministic `unread` hint per thread.

## Goal
Make the inbox feel alive before any local unread state exists.

## Where it's used
- `GET /api/inbox/threads` includes `unread` per item
- The UI still uses local unread as the source of truth:
  - `loadUnreadMap(threadIds, fallbackUnread)`
  - if localStorage value exists, it wins
  - otherwise fallbackUnread (server hint) is used

## Policy
- `anon` role => unread is always 0
- For other roles:
  - unread is > 0 only if the latest message is from "them"
  - value is deterministic by (role + threadId + lockedSide)
  - capped at 5

This is intentionally simple and non-authoritative.
