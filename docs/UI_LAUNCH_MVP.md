# UI Launch MVP — Shell + Safety + Unified Inbox
**Updated:** 2026-01-14

This doc is the **UI single source of truth** for Siddes MVP launch.

Siddes is *context-first*: the UI must constantly answer:
- **Where am I?** (Side)
- **Who will see this?** (audience)
- **How do I switch safely?** (one-tap + reversible)

---

## Principles (non-negotiable)
1. **Side = global mode**
   - Switching Side changes the user’s audience mode across screens.
2. **Chameleon UI**
   - Side color is an accent (dot/border/badge), never a full-screen repaint.
3. **Privacy-first calm**
   - Default flows reduce fear of accidental oversharing.
4. **Discoverability without clutter**
   - Power features exist, but the primary UI stays simple.

---

## Global App Shell (MVP)

### Top Bar (sticky)
**Component:** `frontend/src/components/AppTopBar.tsx`

- Always visible via `AppProviders`
- Left: **SideBadge pill**
  - Tap → `SideSwitcherSheet`
  - Long-press → `PeekSheet`
- Center: screen title

**Psychological rationale:** Side must be visible and one-tap accessible at all times to prevent context collapse.

---

### Bottom Navigation (mobile-first, single-column desktop)
**Component:** `frontend/src/components/BottomNav.tsx`

**Items (4):**
1. Feed → `/siddes-feed`
2. Compose → `/siddes-compose`
3. Inbox → `/siddes-inbox`
4. Me → `/siddes-profile`

**Not in global nav (by design):**
- Sets (`/siddes-sets`) — reachable from Me → Manage
- Invites (`/siddes-invites`) — reachable from Me → Manage
- Notifications (`/siddes-notifications`) — **alias only** (see Unified Inbox)

**Psychological rationale:** feels like a familiar social app. Users should not feel like they’re managing a system.

---

## Unified Inbox (Step 3)
**Route:** `/siddes-inbox`

Inbox is the single “attention hub” with two tabs:
- **Messages** — threads
- **Alerts** — mentions/replies/likes (notifications)

**Implementation**
- Tabs live inside `frontend/src/app/siddes-inbox/page.tsx` (keeps existing inbox checks stable).
- Alerts tab embeds `NotificationsView` in **embedded** mode.
- `/siddes-notifications` redirects to `/siddes-inbox?tab=alerts`.

**Psychological rationale:** Users shouldn’t hunt for “what needs my attention.” One surface reduces fragmentation and increases habit formation.

---

## Profile Manage Panel (Step 1)
**Component:** `frontend/src/components/ProfileView.tsx`

Shown only on self profile (`user.id === "me"`) as a calm card:
- Sets → `/siddes-sets`
- Invites → `/siddes-invites`
- Settings → `/siddes-settings`

**Psychological rationale:** Discoverability without turning the app into a dashboard.

---

## Settings (UI-only stub)
**Route:** `/siddes-settings`

Toggles stored in `localStorage` for MVP:
- In-app alerts
- Push notifications (stub)
- Email digests (stub)

---

## Acceptance checklist (UI)
- [ ] Top bar visible everywhere; SideBadge opens Side switcher.
- [ ] Bottom nav present; content not hidden behind it (`pb-24` in AppProviders).
- [ ] Inbox has tabs (Messages/Alerts) and Alerts renders notifications.
- [ ] `/siddes-notifications` redirects to Inbox Alerts.


## Toasts + Undo (Step 4)
- **No `alert()` in product UI.** All feedback uses toast notifications.
- Toast host: `frontend/src/components/ToastHost.tsx`
- Toast API: `frontend/src/lib/toast.ts` (`toast.info/success/error/undo`)
- Undo is required for **queued offline actions** (posts/replies) via `removeQueuedItem()` in `offlineQueue`.

**Psychological rationale:** Alerts feel like prototypes and increase anxiety. Toasts keep the flow calm and reversible, especially for high-risk actions.

---

## Sets-as-filter

### Launch UX

**Rule:** A *Set* is a **secondary filter inside the current Side**, not a primary navigation destination.

### Feed behavior
- In Friends (and any Side that supports Sets), the feed header shows a single Set control:
  - Default: **All**
  - Tap to open a **Set picker sheet**
  - Selecting a Set filters the feed within the current Side
- **Create Set** is a secondary action (no dashboard clutter).

### Compose behavior
- Composer shows a **manual Set picker** (when the current Side supports Sets).
- AI suggestions may *recommend* Sets, but never auto-switch the Set.
- Deep-link: `/siddes-sets?create=1` can be used from Compose to create a Set without leaving the flow.

### Psychological rationale
- Users naturally think **Audience (Side) → Subgroup (Set)**.
- Keeping Sets as a filter prevents “management UI” vibes and reduces cognitive load.
- Manual control + reversible suggestions preserve psychological safety.


## Sets-as-filter (Step 2)
**Goal:** Sets feel like a *secondary filter* inside a Side—never a dashboard destination.

### Feed
- Friends feed shows a calm **Set** row (All / specific Set) instead of a permanent chips toolbar.
- Tapping the row opens a **Set picker sheet**.
- New Set stays available (dashed button) and uses the existing import/create flow.

### Compose
- Friends compose shows the same **Set** row so manual selection never depends on AI suggestions.
- "New" deep-links to `/siddes-sets?create=1` to keep the composer uncluttered.

**Psych rationale:** Users decide audience first (Side), then subgroup (Set). This hierarchy reduces context-collapse errors and decision fatigue.


## Remixed Feed Modules (flagged)

Feature flag:
- `NEXT_PUBLIC_SD_FEED_MODULES=1`

This enables **UI-only feed modules** ("stealables") injected into `SideFeed` without backend dependency.

**Rules**
- Side-scoped only
- Max 2 modules per feed session
- Never consecutive (modules are inserted after different post indices)
- Dismissible with Undo (no alerts)

**Implementation**
- Planner: `frontend/src/lib/feedModules.ts`
- Renderer: `frontend/src/components/feedModules/FeedModuleCard.tsx`
- Integration: `frontend/src/components/SideFeed.tsx` gated behind `FLAGS.feedModules`

**Current modules (v0)**
- Public: Today in Public
- Friends: Side Health + Set Prompt
- Close: On this day (memory)
- Work: Morning triage
