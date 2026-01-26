# Siddes UI Alignment & Implementation Guide (Snapshot: 2026-01-14)

This is a **developer + designer handoff** for the current repo snapshot you shared, focused on **UI launch readiness** + how to implement the UI so it stays consistent with Siddes’ core promise:

> **Context-first social. Side = global mode. Sets = subgroup filter inside a Side.**

---

## 0) What you already have (and it’s good)

The repo already contains a **clean MVP shell** that matches the “simple, calm, privacy-first” direction.

### Global shell (already implemented)
- **Top bar:** `frontend/src/components/AppTopBar.tsx`
  - Side badge pill → opens Side switcher (and Peek sheet on long-press).
- **Bottom nav:** `frontend/src/components/BottomNav.tsx`
  - `/siddes-feed`, `/siddes-compose`, `/siddes-inbox`, `/siddes-profile`
- Wired globally in: `frontend/src/components/AppProviders.tsx`
  - includes **Toasts** + **Offline QueueIndicator**.

### Launch UI source of truth (already in repo)
- `docs/UI_LAUNCH_MVP.md` (Updated 2026-01-14)

### Sets-as-filter (already implemented)
- Feed header filter control:
  - `frontend/src/components/SetFilterBar.tsx`
  - `frontend/src/components/SetPickerSheet.tsx`
  - Used in `frontend/src/components/SideFeed.tsx`
- Composer set picker:
  - `frontend/src/app/siddes-compose/page.tsx`
- Deep-link to create:
  - `/siddes-sets?create=1` (works)

### Unified Inbox (already implemented)
- `/siddes-inbox` tabs Messages + Alerts:
  - `frontend/src/app/siddes-inbox/page.tsx`
- Thread view:
  - `frontend/src/app/siddes-inbox/[id]/page.tsx`
  - Supports **locked-side** warning + move/unlock patterns.
- Redirect:
  - `/siddes-notifications` → inbox alerts.

---

## 1) The design rules that MUST stay stable

### 1.1 Chameleon UI (no full-screen Side colors)
Use Side colors only as:
- Dot indicators
- Left border accents
- Small chips/badges
- Ring focus states

Canonical tokens live in:
- `frontend/src/lib/sides.ts` → `SIDE_THEMES`

**Important:** Tailwind JIT safety  
Do **not** build classes like `ring-${color}` dynamically. Use static strings (the repo already does this well).

### 1.2 The hierarchy users must feel
**Side (audience mode) → Set (subgroup filter) → Content**

- Side is **always** visible.
- Set is **always** optional and only exists inside a Side.
- Anything that changes audience must be explicit and reversible.

### 1.3 Naming (don’t accidentally become a clone)
Hard rules:
- Do **not** use “Siders” anywhere.
- Do **not** use “Circles” anywhere (Google+ association).
- Prefer:
  - **Side (verb)** = side/subscribe (action)
  - **Sided (state)** = you are connected
  - **Siders** = people who sided you (only visible to owner by default)
  - **Siding** = people you side (owner-only by default)
- Prefer “Set” for subgroup. Avoid “Circle Health” naming.

---

## 2) What is “missing” vs what is “already solved”

### 2.1 Already solved in code, but your new mocks rename/reshape it
**Public “topics” (Politics, Tech, …)** are already modeled as **Public Topics**:
- Data: `frontend/src/lib/publicChannels.ts`
  - currently: `general | tech | politics | personal`
- UI:
  - filter row: `frontend/src/components/PublicChannelFilterRow.tsx` (used in SideFeed when flag on)
  - chip on posts: `frontend/src/lib/chips.ts` (topic chip)

✅ You are not starting from zero.  
➡️ Your “Public Topics” mock should map to **Public Topics**, not generic hashtags.

### 2.2 Missing (not implemented yet)
These are the big gaps between “mock direction” and current code:

1) **Terminology mismatch**
   - Profile uses “Side” (should become “Side / Sided”):
     - `frontend/src/components/ProfileView.tsx` (search “Side”)
   - Public tuning calls things “Granular Siding” (fine), but action label must match “Side”.

2) **Side Personas (the big differentiator)**
   - Current profile is Side-access aware, but does **not** show different names/bios/avatars per Side.
   - Needed: UI scaffolding + storage (local first; backend later).

3) **Work Mode “extras”**
   - You have Work Side feed, but not yet:
     - task composer
     - task cards
     - kanban toggle

4) **Remixed feed modules (“stealables”)**
   - You have the *idea mocks*, but no integration in SideFeed yet:
     - Context/Side Health cards
     - Prompts
     - Memories
     - Glance strip
     - Mutual nudges
     - Invite moments
     - Work triage/decision cards

5) **Media surfaces**
   - PostCard currently shows placeholder media blocks.
   - Your media mocks imply real image/video/gallery/link previews.

---

## 3) How to implement your mocks in THIS repo (the clean way)

### 3.1 Add a “Feed Module” system (UI-only, safe, optional)
Create:
- `frontend/src/lib/feedModules.ts`
- `frontend/src/components/feedModules/*`

Design:
```ts
export type FeedModuleKind =
  | "side_health"
  | "set_prompt"
  | "memory"
  | "glance_strip"
  | "mutual_nudge"
  | "invite_moment"
  | "work_triage"
  | "decision_log";

export type FeedModule = {
  id: string;
  side: "public" | "friends" | "close" | "work";
  kind: FeedModuleKind;
  // Optional payload by kind (keep minimal)
  payload?: Record<string, any>;
};
```

Integration:
- In `frontend/src/components/SideFeed.tsx`
  - after `items` are loaded, inject modules at fixed positions (e.g., after item 1, after item 3)
  - keep it **small**: max 2 modules per feed per session.

Flag it:
- `NEXT_PUBLIC_SD_FEED_MODULES=1`

Why this is correct:
- You keep provider contracts unchanged (feed stays `FeedPost[]`).
- Modules are UI-local and can be iterated without backend dependency.

### 3.2 Implement “Public Topics” as “Public Topics v2”
What to do:
- Expand `PUBLIC_CHANNELS` in `frontend/src/lib/publicChannels.ts` only if needed.
  - Add: sports, entertainment, crypto (if you really want them at launch)
- Keep “Today in Public” as a **module** (not a permanent hashtag dashboard):
  - `kind: "side_health"` but title “Today in Public”
  - Clicking a trend sets the `activeChannel` in `SideFeed`.

UI pattern:
- Topic filter row already exists under flag:
  - Keep it calm.
  - No giant hashtag screens for MVP.

### 3.3 Implement Side Personas (UI-first)
Create a local-storage model (v0):
- `sd.personas.v0 = { split: boolean, personas: { public: {...}, friends: {...}, close: {...}, work: {...} } }`

Add:
- `frontend/src/app/siddes-profile/edit/page.tsx` (or a sheet)
- In `ProfileView.tsx`, if viewer is owner:
  - show “Preview as…” toggle (Owner tool only)
- For non-owner viewing:
  - show persona matching the relationship side (later this becomes server-enforced)

This is the “not a clone” feature. It should become a headline product demo.

### 3.4 Implement “Side / Sided / Unside” labels
Where:
- `frontend/src/components/ProfileView.tsx`

Rules:
- Default button label: **Side**
- After action: **Sided**
- Destructive: **Unside** requires confirmation (sheet/modal)
- Viewer privacy:
  - outsiders should not see owner’s Siders/Siding lists by default
  - show only mutuals if you build a Connections page

### 3.5 Work extras (UI-only first)
Where:
- Add `frontend/src/components/work/*` for:
  - WorkComposer
  - TaskCard
  - Board view (simple stub)
- Integrate in `SideFeed.tsx` when `side === "work"`:
  - header toggle List/Board
  - first item can be WorkTriage module

---

## 4) Designer checklist: what to mock next (so you can pick later)

Your designer should mock these as **small, reusable feed cards**, not whole new dashboards:

### A) Public Topics (topic system)
- Public feed with:
  - topic pills (All + topics)
  - 1–2 topic chips on each post
  - optional “Today in Public” summary card (module)

### B) Side Personas
- Profile self view:
  - toggle: Global profile vs split personas
  - preview as: Public/Friends/Close/Work
- Profile other view:
  - show “Viewing via Friends/Work…” stamp (dot + label)
  - “Side” action button

### C) Remixed feed modules (pick 2 per Side)
- **Public:** Today in Public (trends)
- **Friends:** Set Prompt (Book Club question)
- **Close:** On This Day memory
- **Work:** Morning Triage + Decision Log (optional)

### D) Work tasks (lightweight, not Jira)
- Task composer (expandable)
- Task card (with due + priority)
- Board toggle (simple)

### E) PWA/offline
- Small queue indicator (you already have `QueueIndicator`)
- Optional outbox screen (later)

---

## 5) Backend alignment (what is real vs stub today)

Providers (frontend):
- Feed: `frontend/src/lib/feedProvider.ts`
- Sets: `frontend/src/lib/setsProvider.ts`
- Inbox: `frontend/src/lib/inboxProvider.ts`
- Invites: `frontend/src/lib/inviteProvider.ts`

DRF API root (backend):
- `backend/siddes_backend/api.py` routes:
  - `/api/feed`
  - `/api/post/*`
  - `/api/sets/*`
  - `/api/invites/*`
  - `/api/inbox/*`

Dev identity rule:
- Viewer identity is via `sd_viewer` cookie or `x-sd-viewer` header (default-safe restriction if missing).

---

## 6) Recommended “UI-first” build order (fastest path to a coherent launch)

1) **Terminology pass**
   - “Side” → “Side / Sided / Unside”
   - Remove “Circle” language from card names (“Circle Health” → “Context Health” / “Side Health”)

2) **Public Topics v2**
   - Expand topics minimally
   - Add “Today in Public” module (optional)

3) **Feed Modules framework (flagged)**
   - Implement 3 modules max to start:
     - Side health, Set prompt, Memory

4) **Work extras (flagged)**
   - Work composer + Task cards + simple Board toggle

5) **Side Personas v0**
   - Local storage implementation + profile edit UI

---

## Appendix: Route map (current)

- `/siddes-feed` → `frontend/src/app/siddes-feed/page.tsx`
- `/siddes-compose` → `frontend/src/app/siddes-compose/page.tsx`
- `/siddes-inbox` → `frontend/src/app/siddes-inbox/page.tsx`
- `/siddes-inbox/[id]` → thread
- `/siddes-profile` → profile
- `/siddes-sets` (+ `/siddes-sets/[id]`) → sets management
- `/siddes-invites` (+ `/invite/[id]`) → invites
- `/siddes-settings` → local settings stub
