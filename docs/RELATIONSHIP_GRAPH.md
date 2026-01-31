# Siddes Relationship Graph (Single Source of Truth)

Siddes has **two separate graphs**. Mixing them causes user confusion.

## 1) Public Follow Graph

**Follow** is a one-way subscription to a user's **Public** presence.

- Edge: `UserFollow(follower -> target)`
- Grants: **Public only**
- Does NOT grant: Friends / Close / Work

UI rule: Follow is always a **single-tap toggle** (Follow / Following).

## 2) Side Access Graph (Friends / Close / Work)

Side access is **directional** and **scoped**.

### A) "They show you"
What you can see of someone is controlled by their edge to you:

- Edge: `SideMembership(owner=them, member=you, side=friends|close|work)`
- Server enforces `allowedSides` and returns `locked` for escalation.

### B) "You show them"
What they can see of you is controlled by your edge to them:

- Edge: `SideMembership(owner=you, member=them, side=friends|close|work)`
- Close requires Friends first.
- Close/Work require confirm.

UI rule (profile page): keep it WhatsApp-simple:
- **Add Friend** = one tap sets **you show them: Friends**
- Upgrading to Close/Work is done in **Settings → Prism People** (intentional, not accidental).

## 3) Access Requests

When a user is locked from a Side, they can request access:

- POST `/api/access-requests` → owner decides later
- Accept creates/updates a `SideMembership(owner=owner, member=requester, side=grantedSide)`
- Close requests may grant Friends first (no skipping).

UI rule: Locked state provides a **single-tap Request** button, but it never unlocks instantly.
