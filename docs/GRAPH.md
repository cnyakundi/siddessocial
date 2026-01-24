# Siddes Graph — Prism Relationships

This doc explains the **real relationship graph** that powers Siddes Sides (Public / Friends / Close / Work).

Siddes is not a “people I subscribe to” product. It is a **directional privacy graph**: _who can see which facet of me_.

---

## The 3 Prism primitives

### 1) `PrismFacet` (identity per Side)

A user has **one facet per Side**:

- Public facet
- Friends facet
- Close facet
- Work facet

Each facet is just a profile surface: display name, bio, avatar, etc.

### 2) `SideMembership` (the graph edge)

A `SideMembership` is a **directed edge**:

```
owner  ──side=friends|close|work──▶  member
```

Meaning:

> **Owner is granting Member access to Owner’s facet/posts for that Side.**

Examples:

- `A ──friends──▶ B` means **B can view A’s Friends identity/posts.**
- `A ──close──▶ B` means **B can view A’s Close identity/posts.**
- `A ──work──▶ B` means **B can view A’s Work identity/posts.**

Public is special:

- **Public is the absence of a relationship edge.**
- If there is no `SideMembership(owner=A, member=B)`, then B sees **A Public**.

### 3) The “Side action” (what you do in the UI)

When you “Side” someone in the UI, you are creating/updating:

- `SideMembership(owner=YOU, member=THEM, side=...)`

That is why Siddes must always speak directionally:

- **“You show them: Friends / Close / Work.”**
- **Not:** “Put them in Close so you can see their Close.”

---

## How profile access is resolved (server-truth)

When `viewer` visits `target`:

1) The server looks up:

- `SideMembership(owner=target, member=viewer)`

2) That sets:

- `viewSide` = what the target is showing the viewer
- `allowedSides` = a safe list that **never allows escalation**

If the viewer requests a Side outside `allowedSides`, the server returns `403 locked`.

This is the core invariant:

> A viewer must never be able to “click into” a deeper Side unless the target already granted it.

---

## Safety invariants (non-negotiable)

1) **No access escalation**
- Viewer cannot self-upgrade into target’s Close/Work.

2) **Close requires Friends**
- Upgrading someone into Close should require they are already in Friends (or do Friends-first automatically).

3) **Sensitive Sides require confirmation**
- Close and Work must require an explicit confirmation step (UI and/or server).

4) **Blocks override everything**
- If either side blocks, private surfaces must not leak.

---

## UI language rules

Use explicit direction everywhere:

- **They show you:** Public / Friends / Close / Work
- **You show them:** Public / Friends / Close / Work

And for locked surfaces:

- **Locked** → “You can’t see this unless they’ve placed you in that Side.”
- Provide a separate action to “Manage what you show them” (so you don’t accidentally grant access).

---

## Debug checklist for “This feels unsafe”

If someone claims “I can see a private Side,” verify:

- Profile response includes correct `viewSide` and `allowedSides`
- Requests for a locked Side return `403 locked`
- Post/feed endpoints filter by `SideMembership(owner=author, member=viewer)`
