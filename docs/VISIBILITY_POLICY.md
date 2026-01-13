# Server-side Visibility Policy (Sides)
**Updated:** 2026-01-09

This is the privacy backbone of Siddes. Close/Work MUST be enforced server-side.

---

## Core rules (v0)
- **Public**: visible to anyone
- **Friends**: visible if viewer ∈ author’s friends membership
- **Close**: visible if viewer ∈ author’s close membership
- **Work**: visible if viewer ∈ author’s work membership
- **Author always sees their own posts**

---

## What must never happen
- UI-only privacy (e.g. “Close” posts returned from API to non-close users)
- leaking counts (“20 posts in Close”) to someone without access
- allowing client-provided side to bypass policy

---

## Where policy is enforced
### Feed query
Server filters by:
- side
- membership

### Post detail
Server validates `can_view_post` for viewer.

---

## Django implementation notes
- represent relationships in DB (join tables)
- filter posts with ORM conditions
- never return private posts to unauthorized viewers

---

## Selftest
```bash
python3 backend/siddes_visibility/demo.py --selftest
```
