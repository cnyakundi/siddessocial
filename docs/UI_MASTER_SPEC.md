# Siddes UI Master Spec (MVP → Launch)

**Updated:** 2026-01-14  
**Audience:** Product Designer, Frontend/Backend Engineers, and any collaborator who needs to work in this repo.

This document consolidates **all agreed UI designs + rules** for Siddes and maps them to the current repo.  
It is intentionally opinionated: **context-first, calm, privacy-first.**

---

## 0) Siddes mental model (the thing we are building)

### 0.1 The three layers
1) **Side (global context mode)**  
   Public (Blue), Friends (Emerald), Close (Rose), Work (Slate)

2) **Set (subgroup inside a Side)**  
   Example: Gym Crew, Family, Startup Core  
   **Sets never exist outside a Side.** They are filters and audiences inside the chosen Side.

3) **Topics (Public-only categories)**  
   Example: Politics, Tech, Sports  
   **Implementation detail:** Topics are currently implemented as `publicChannel` internally.

### 0.2 The Siddes contract to users
- “You always know who you’re talking to.”
- “You never accidentally post to the wrong audience.”
- “Privacy is enforced by structure, not by settings.”

---

## 1) Naming & terminology (non‑negotiable)

Avoid making Siddes feel like a clone:

### 1.1 Never use
- Siders / Siding
- Circles
- Stories / Rings language or visuals

### 1.2 Use
- **Side** (verb): connect with someone in Siddes  
- **Sided**: connected state  
- **Unside**: remove connection (requires confirmation)
- **Siders**: people who sided you (owner-only by default)
- **Siding**: people you side (owner-only by default)
- **Set**: subgroup inside a Side
- **Topics**: Public categories (internally: public topics)

---

## 2) Chameleon UI rules (visual system)

### 2.1 “No full-screen color”
Side colors are accents only:
- tiny dot
- small badge/chip
- thin border
- focus ring
- icon accent

### 2.2 Tailwind JIT safety
Do **not** generate dynamic Tailwind class strings like `ring-${color}`.  
Always use explicit classes (static strings) or token maps.

Canonical theme tokens:
- `frontend/src/lib/sides.ts` → `SIDE_THEMES`

---

## 3) Navigation IA (MVP)

### 3.1 Desktop / Web
- **Left rail:** Side switcher (Public/Friends/Close/Work)
- **Top bar:** scoped search, inbox bell, profile menu
- **Center column:** single-column feed layout (no dashboard sprawl)
- **Right drawer:** Inbox (optional)

### 3.2 Mobile / PWA
- **Top header:** context pill + quick actions (Search, Inbox)
- **Bottom dock:** Home / Discover / Create / Inbox / Me
- **Side switcher:** a bottom sheet (“Switch Context”) from the pill

---

## 4) Pages and components (the MVP suite)

This is the “all pages we agreed on” list.

### 4.1 Side Feed (core)
**Purpose:** browse content in one Side, optionally filtered by Set or Topic.

Must include:
- Side indicator always visible
- Set filter row inside Friends/Close/Work
- Topics filter (Public only)
- Calm, uncluttered post card
- Context stamp on each card (tiny)

Repo mapping:
- Page: `frontend/src/app/siddes-feed/page.tsx`
- Feed: `frontend/src/components/SideFeed.tsx`
- Post card: `frontend/src/components/PostCard.tsx`
- Set filter: `frontend/src/components/SetFilterBar.tsx`
- Set picker: `frontend/src/components/SetPickerSheet.tsx`
- Public topics (internal “topics”): `frontend/src/lib/publicChannels.ts`

### 4.2 Compose (posting)
**Purpose:** create a post with zero risk of wrong Side.

Rules:
- Composer always shows **current Side** with a colored dot + label.
- If posting to a Set, Set selection is explicit.
- Public posts can optionally include Topic selection.

Repo mapping:
- Page: `frontend/src/app/siddes-compose/page.tsx`
- Intent bar: `frontend/src/components/ComposeSuggestionBar.tsx`

### 4.3 Post Detail (replies + deep links)
**Purpose:** thread view that preserves Side context; safe reply composer.

Rules:
- Post detail must show Side stamp prominently.
- Reply composer must be scoped to the post’s Side.
- If user is in the wrong Side and tries to reply: show context-switch guard.

Repo mapping:
- Page: `frontend/src/app/siddes-post/[id]/page.tsx`

### 4.4 Inbox (Messages + Alerts)
**Purpose:** unified inbox with context safety.

Rules:
- Messages can exist in any Side; switching thread may require context switch confirmation.
- Alerts are Side-scoped (avoid leakage).
- Avoid overwhelming; default to calm list view.

Repo mapping:
- Inbox: `frontend/src/app/siddes-inbox/page.tsx`
- Thread: `frontend/src/app/siddes-inbox/[id]/page.tsx`
- Banner patterns: `frontend/src/components/InboxBanner.tsx`

### 4.5 Profile (Self + Other)
**Purpose:** show identity with Side-aware privacy.

Rules:
- Self-view can preview: “what does Public/Friends/Work see?”
- Other-view shows “Viewing via Friends/Work …” stamp.
- Connection action uses **Side / Sided / Unside** (confirm destructive)
- Siders/Siding lists should be private by default (viewer sees mutuals only).

Repo mapping:
- Page: `frontend/src/app/siddes-profile/page.tsx`
- View: `frontend/src/components/ProfileView.tsx` (needs Side/Sided naming pass)

### 4.6 Sets (subgroups)
**Purpose:** create/manage Sets; filter feed by Set; invite into Set.

Rules:
- Sets are always contained within their parent Side.
- Feed set picker should only show sets in that Side.
- Create Set is a guided flow (fast).

Repo mapping:
- Page: `frontend/src/app/siddes-sets/page.tsx`
- Guided create: `frontend/src/components/CreateSetSheet.tsx`

### 4.7 Invites
**Purpose:** invite into a Side or Set via link; acceptance flow.

Rules:
- Invite is context-scoped.
- Acceptance explains “you will see their X persona”.

Repo mapping:
- Dashboard: `frontend/src/app/siddes-invites/page.tsx`
- Acceptance: `frontend/src/app/invite/[id]/page.tsx`

### 4.8 Settings (local stubs ok)
**Purpose:** preferences, debug toggles, PWA info.

Repo mapping:
- Page: `frontend/src/app/siddes-settings/page.tsx`

---

## 5) Remixed feed modules (“stealables”)

These are optional feed cards that remix learnings from apps like BeReal, Locket, Google+, etc.
They must be:
- calm
- Side-scoped
- dismissible with undo
- **not spammy**
- max 2 per feed session

Implementation (flagged):
- Flag: `NEXT_PUBLIC_SD_FEED_MODULES=1`
- Planner: `frontend/src/lib/feedModules.ts`
- Renderer: `frontend/src/components/feedModules/FeedModuleCard.tsx`
- Injection: `frontend/src/components/SideFeed.tsx`

Module catalog (v0):
- Public: Today in Public (topics/trends)
- Friends: Side Health + Set Prompt
- Close: On this day (memory)
- Work: Morning triage

---

## 6) Public Topics (politics, tech, sports, …)

### 6.1 UX
- Public feed has a Topics filter row:
  - “All Topics” + a few broad categories
  - an optional “Today in Public” trend card (module)

### 6.2 Implementation
Currently implemented internally as `publicChannel`:
- `frontend/src/lib/publicChannels.ts`
- `frontend/src/lib/publicSiding.ts`
- `frontend/src/lib/publicTrustDial.ts`

UI copy should say **Topics** (not topics).

---

## 7) Work Side extras (lightweight, not Jira)

Goal: Work feels like “updates + tasks”, without becoming a dashboard.

Desired UX (not yet integrated):
- Expandable Work composer:
  - normal update
  - optional task fields (due, assignee, priority)
- Task cards in feed
- Board toggle (list ↔ board) for Work

This can begin as UI-only and remain stubbed.

---

## 8) Media + links policy

Rules:
- **Close + Work** should restrict external sharing by default.
- Videos autoplay **Public only** (muted), other sides require tap.
- Gallery shows 4-grid + “+N” overlay.

Currently: media is mostly placeholder in PostCard.  
Treat this as a later polishing phase.

---

## 9) PWA / offline

Rules:
- Show queue indicator when offline (Outbox/queued posts).
- Never lose a post: offline outbox should persist.

Docs:
- `docs/PWA_PLAN.md`
- `docs/NEXT_DEV_CACHE.md`

---

## 10) What to build next (highest leverage)

1) **Terminology pass**: Side → Side/Sided + Unside confirm in Profile
2) **Public Topics copy pass**: Topics → Topics in UI
3) **Side Personas v0**: local storage + profile edit UI
4) **Work extras v0**: composer + task cards + board toggle (UI-only)
5) **Media polish**: image/video/link/gallery policies

---

## Appendix: Flags (current)

- `NEXT_PUBLIC_SD_FEED_MODULES=1` — remixed feed modules
- `NEXT_PUBLIC_SD_PUBLIC_CHANNELS=1` — Public Topics (internal topics)
- `NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL=1` — trust dial UI
- `NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES=1` — enforcement scaffolding
- `NEXT_PUBLIC_SD_PUBLIC_CALM_UI=1` — calm UI mode

---

## Desktop reading width (Tumblr-width)

Desktop is **not** a dashboard. Keep a single calm center column:

- Left rail: ~72–80px
- Center column: **max 680px** (never exceed ~760px)
- Right drawer optional (Inbox), must not destroy reading width

Implementation helper:
- `frontend/src/components/ContentColumn.tsx` → `max-w-[680px] mx-auto px-4`
