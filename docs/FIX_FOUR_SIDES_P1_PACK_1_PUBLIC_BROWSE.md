# Four Sides Fix — P1 Pack 1: Public Browse (Read-only)

**Overlay:** sd_745_four_sides_fix_p1_pack_1_public_browse_readonly

## Goal
Let logged-out users **browse the Public feed** (read-only) so Siddes can deliver value before asking for sign-in.

## What changed
### Backend
- `GET /api/feed?side=public` now returns **Public posts** even when the viewer is unknown (anon).
- `side=friends|close|work` remains **restricted by default** when viewer is unknown.

### Frontend
- When on **Public** and not authenticated, the in-feed composer is replaced with a small CTA:
  - “Browse Public — Sign in to post, reply, like, or save.”
- Public empty state now shows **“Sign in to post”** instead of “New Post” when logged-out.

## Acceptance
- Logged-out user can open `/siddes-feed` and see Public items (if any exist).
- Switching to Friends/Close/Work while logged-out shows the existing restricted state.
- Logged-out user does not see an inline composer box in Public (read-only UX).

## Files
- `backend/siddes_feed/views.py`
- `frontend/src/components/SideFeed.tsx`
