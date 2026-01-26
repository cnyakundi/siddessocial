# FIX: Four Sides — P0 Pack 2 (Close implies Friends)

**Overlay:** sd_741_four_sides_fix_p0_pack_2_close_implies_friends  
**Date:** 2026-01-26  
**Goal:** Remove the biggest “rule learned by failing” friction: **Close requires Friends**.

---

## Problem
When a user tries to place someone into **Close** before **Friends**, the server returns:

- `error = friends_required`

Previously, the UI surfaced this as a blocking error toast, which feels like the app scolding the user.

---

## Fix (UX)
If user selects **Close** and the server responds `friends_required`:

1) Show a calm informational toast:  
   **“Close is inside Friends — adding to Friends first…”**

2) Automatically:
   - set side to **Friends**
   - then retry **Close**

No user-facing failure for the normal path.

---

## Files changed
- `frontend/src/app/u/[username]/page.tsx`

---

## Smoke test
1) Open a profile for someone you are not already “Friends” with.
2) Tap “Close”.
3) Expected:
   - You see the info toast (“Close is inside Friends…”)
   - The action succeeds (viewerSidedAs becomes Close)
   - You do **not** see a “friends_required” error toast

