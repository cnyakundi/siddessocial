# Phase 2.1 — Chameleon Plumbing (Side state + theme switching)

This pack describes **how Siddes “knows” what Side you are in**, how that Side is **persisted + synchronized**, and how UI surfaces apply **Side-aware color tokens** (the “Chameleon” rule).

> Scope: **structural + flow mapping** only (no fix suggestions).

---

## 1) Canonical primitives (frontend)

### 1.1 SideId
- `type SideId = "public" | "friends" | "close" | "work"`
- File: `frontend/src/lib/sides.ts`

### 1.2 Side metadata (labels + privacy hints)
- `SIDES[side] = { label, desc, privacyHint, isPrivate }`
- Used anywhere the UI needs human-readable Side meaning.
- File: `frontend/src/lib/sides.ts`

### 1.3 Tailwind-safe theme tokens
- `SIDE_THEMES[side] = { primaryBg, text, ring, lightBg, border, accentBorder, hoverBg }`
- These are **static Tailwind class strings** (no CSS variables).
- File: `frontend/src/lib/sides.ts`

### 1.4 Helpers
- `isSideId(v)` → runtime guard
- `nextSide(current, dir)` → cycling helper
- File: `frontend/src/lib/sides.ts`

### 1.5 Set theme tokens (separate from Sides)
- `SET_THEMES[color] = { bg, text, border }`
- Note: stored SetColor "blue" is mapped to slate in UI (blue reserved for Public Side).
- File: `frontend/src/lib/setThemes.ts`

---

## 2) Side state: provider + persistence

### 2.1 Storage keys
- Active Side: `sd.activeSide`
- Last non-Public Side: `sd.lastNonPublicSide`
- File: `frontend/src/lib/sideStore.ts`

### 2.2 Persistence utilities
- `getStoredActiveSide()` / `setStoredActiveSide()`
- `getStoredLastNonPublicSide()` / `setStoredLastNonPublicSide()`
- All are `window.localStorage`-based, guarded by `hasWindow()`.
- File: `frontend/src/lib/sideStore.ts`

### 2.3 SideProvider (global state)
- React Context holds `{ side, setSide, cycleSide }`.
- Default initial state: `friends`.
- On mount: reads stored active side; writes last-non-public side when appropriate.
- Cross-tab sync: listens for `storage` events on `sd.activeSide`.
- File: `frontend/src/components/SideProvider.tsx`

---

## 3) Boot sequence / wiring

### 3.1 Global mount
- `RootLayout` → wraps app with `AppProviders`.
- File: `frontend/src/app/layout.tsx`

### 3.2 AppProviders composition
- `SideProvider` is the root.
- Immediately mounts:
  - `FirstRunSidePicker` (FTUE Side choice)
  - `AuthBootstrap` (route auth gating)
  - `AppShell` (chrome)
  - plus PWA/offline/toast helpers
- File: `frontend/src/components/AppProviders.tsx`

---

## 4) Switching surfaces (where Side can change)

### 4.1 FirstRunSidePicker (FTUE)
- Shows only when **no stored active side** exists.
- Writes side via `setSide()` and closes.
- File: `frontend/src/components/FirstRunSidePicker.tsx`

### 4.2 SideBadge (the “pill”)
- Reads active side via `useSide()` unless `sideId` prop overrides.
- Visual badge uses `SIDES + SIDE_THEMES`.
- Supports optional long-press.
- File: `frontend/src/components/SideBadge.tsx`

### 4.3 SideSwitcherSheet (Side menu)
- Sheet lists all sides in `SIDE_ORDER`.
- Public entry is “guardrailed” via `PublicEnterConfirmSheet`.
- File: `frontend/src/components/SideSwitcherSheet.tsx`

### 4.4 PublicEnterConfirmSheet (Public doorway moment)
- Reusable confirmation modal for entering Public.
- Used by multiple nav surfaces + broadcast routes.
- File: `frontend/src/components/PublicEnterConfirmSheet.tsx`

### 4.5 AppTopBar (mobile top chrome)
- Side pill → opens `SideSwitcherSheet`.
- File: `frontend/src/components/AppTopBar.tsx`

### 4.6 BottomNav (mobile)
- “Public” tab:
  - If not currently public → opens `PublicEnterConfirmSheet`.
- “Home” tab:
  - If currently public → returns to `sd.lastNonPublicSide`.
- File: `frontend/src/components/BottomNav.tsx`

### 4.7 DesktopSideRail (desktop)
- Side icons column; entering Public is guarded with `PublicEnterConfirmSheet`.
- File: `frontend/src/components/DesktopSideRail.tsx`

### 4.8 Broadcast pages (Public-only surfaces)
- If user is not in Public, these pages show `PublicEnterConfirmSheet` (route-level guard).
- Files:
  - `frontend/src/app/siddes-broadcasts/page.tsx`
  - `frontend/src/app/siddes-broadcasts/create/page.tsx`
  - `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
  - `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`

---

## 5) How theme switching actually happens

### 5.1 No global theme engine
- There is **no** CSS-variable theme provider.
- Theme is applied by:
  1) reading the active `side` (usually via `useSide()`)
  2) computing `const theme = SIDE_THEMES[side]`
  3) using `theme.*` Tailwind class strings in `className`

### 5.2 Two consumption patterns
1) **Hook-driven**
   - Component calls `useSide()` and styles itself.
   - Example: `AppTopBar`, `BottomNav`, `SideFeed`, `NotificationsView`, etc.

2) **Prop-driven**
   - Parent passes `side` down to avoid extra context reads.
   - Example: `SideFeed` → passes `side` into `PostCard`.

---

## 6) Side → API bridging (where Side affects network calls)

### 6.1 Feed fetch is side-scoped
- `/api/feed?side=<side>` is used for:
  - feed rendering
  - side activity polling
- Files:
  - `frontend/src/components/PeekSheet.tsx`
  - `frontend/src/lib/sideActivity.ts`
  - (feed provider ultimately calls `/api/feed?side=...`)

### 6.2 Compose entry is side-tagged
- Compose links carry `?side=<side>`.
- Compose reads `requestedSide` from URL and shows a banner if it doesn’t match active side.
- Files:
  - `frontend/src/components/SideFeed.tsx`
  - `frontend/src/components/BottomNav.tsx`
  - `frontend/src/app/siddes-compose/client.tsx`

### 6.3 Side is explicitly passed to some post actions
- Example: echo uses `?side=<side>` + body `{ side }`.
- File: `frontend/src/components/PostCard.tsx`

---

## 7) Guardrails that are part of “Chameleon safety”

### 7.1 Public entry confirmation
- Centralized modal (`PublicEnterConfirmSheet`) prevents accidental context switch to Public.
- Wired in:
  - `SideSwitcherSheet`
  - `BottomNav`
  - `DesktopSideRail`
  - Broadcast route pages

### 7.2 “Safe compose” when link targets another side
- Compose detects URL `side=` intent and prompts user to enter that side before posting.
- File: `frontend/src/app/siddes-compose/client.tsx`

### 7.3 Blue reserved for Public
- Sets render blue as slate to avoid confusing Public-vs-private color semantics.
- File: `frontend/src/lib/setThemes.ts`

---

## 8) Complete call-site inventory (chameleon touchpoints)

### 8.1 Files that call `useSide()`
(22 files)
- frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx
- frontend/src/app/siddes-broadcasts/[id]/page.tsx
- frontend/src/app/siddes-broadcasts/create/page.tsx
- frontend/src/app/siddes-broadcasts/page.tsx
- frontend/src/app/siddes-compose/client.tsx
- frontend/src/app/siddes-inbox/[id]/page.tsx
- frontend/src/app/siddes-inbox/page.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/app/siddes-profile/page.tsx
- frontend/src/components/AppTopBar.tsx
- frontend/src/components/BottomNav.tsx
- frontend/src/components/DesktopButlerTray.tsx
- frontend/src/components/DesktopRightRail.tsx
- frontend/src/components/DesktopSideRail.tsx
- frontend/src/components/DesktopTopBar.tsx
- frontend/src/components/FirstRunSidePicker.tsx
- frontend/src/components/ImportSetSheet.tsx
- frontend/src/components/NotificationsView.tsx
- frontend/src/components/SideBadge.tsx
- frontend/src/components/SideChrome.tsx
- frontend/src/components/SideFeed.tsx
- frontend/src/components/SideProvider.tsx

### 8.2 Files that reference `SIDE_THEMES` (styling tokens)
(39 files)
- frontend/src/app/launchpad/composer-studio/studioClient.tsx
- frontend/src/app/search/client.tsx
- frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx
- frontend/src/app/siddes-broadcasts/page.tsx
- frontend/src/app/siddes-compose/client.tsx
- frontend/src/app/siddes-inbox/[id]/page.tsx
- frontend/src/app/siddes-inbox/page.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/app/siddes-profile/page.tsx
- frontend/src/app/siddes-sets/[id]/page.tsx
- frontend/src/app/siddes-sets/page.tsx
- frontend/src/components/AppTopBar.tsx
- frontend/src/components/BottomNav.tsx
- frontend/src/components/ComposeSuggestionBar.tsx
- frontend/src/components/CreateSetSheet.tsx
- frontend/src/components/DesktopButlerTray.tsx
- frontend/src/components/DesktopRightRail.tsx
- frontend/src/components/DesktopSideRail.tsx
- frontend/src/components/DesktopTopBar.tsx
- frontend/src/components/EchoSheet.tsx
- frontend/src/components/FirstRunSidePicker.tsx
- frontend/src/components/ImportSetSheet.tsx
- frontend/src/components/NotificationsView.tsx
- frontend/src/components/PeekSheet.tsx
- frontend/src/components/PostCard.tsx
- frontend/src/components/PrismProfile.tsx
- frontend/src/components/PublicEnterConfirmSheet.tsx
- frontend/src/components/QuoteEchoComposer.tsx
- frontend/src/components/ReplyComposer.tsx
- frontend/src/components/RitualCreateSheet.tsx
- frontend/src/components/RitualDock.tsx
- frontend/src/components/RitualSheet.tsx
- frontend/src/components/SideBadge.tsx
- frontend/src/components/SideFeed.tsx
- frontend/src/components/SideSwitcherSheet.tsx
- frontend/src/components/SuggestedSetsSheet.tsx
- frontend/src/components/feedModules/FeedModuleCard.tsx
- frontend/src/lib/chips.ts
- frontend/src/lib/sides.ts

### 8.3 Files that reference `SIDES` (labels/meaning + privacy hints)
(32 files)
- frontend/src/app/launchpad/composer-studio/studioClient.tsx
- frontend/src/app/search/client.tsx
- frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx
- frontend/src/app/siddes-compose/client.tsx
- frontend/src/app/siddes-inbox/[id]/page.tsx
- frontend/src/app/siddes-inbox/page.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/app/siddes-sets/[id]/page.tsx
- frontend/src/app/siddes-sets/page.tsx
- frontend/src/components/AppTopBar.tsx
- frontend/src/components/ComposeSuggestionBar.tsx
- frontend/src/components/CreateSetSheet.tsx
- frontend/src/components/DesktopButlerTray.tsx
- frontend/src/components/DesktopSideRail.tsx
- frontend/src/components/DesktopTopBar.tsx
- frontend/src/components/FirstRunSidePicker.tsx
- frontend/src/components/NotificationsView.tsx
- frontend/src/components/PeekSheet.tsx
- frontend/src/components/PostCard.tsx
- frontend/src/components/PrismProfile.tsx
- frontend/src/components/PublicEnterConfirmSheet.tsx
- frontend/src/components/ReplyComposer.tsx
- frontend/src/components/RitualCreateSheet.tsx
- frontend/src/components/RitualDock.tsx
- frontend/src/components/RitualSheet.tsx
- frontend/src/components/SideBadge.tsx
- frontend/src/components/SideFeed.tsx
- frontend/src/components/SideSwitcherSheet.tsx
- frontend/src/components/SuggestedSetsSheet.tsx
- frontend/src/components/feedModules/FeedModuleCard.tsx
- frontend/src/lib/sideActivity.ts
- frontend/src/lib/sides.ts

---

## 9) Cross-layer Side contract (backend)

Even though the “Chameleon” visuals are frontend, the **SideId values are enforced server-side**.

### 9.1 SideId definitions found in backend
- Visibility policy literal: `backend/siddes_visibility/policy.py`
- Post DB choices: `backend/siddes_post/models.py`
- Sets SideId TextChoices: `backend/siddes_sets/models.py`
- Inbox SideId TextChoices (+ locked_side, message.side): `backend/siddes_inbox/models.py`
- Rituals choices: `backend/siddes_rituals/models.py`
- Prism facets + side membership: `backend/siddes_prism/models.py`
- Invites side string: `backend/siddes_invites/models.py`

---

## 10) Third-party tissue used by Chameleon block

### 10.1 Frontend
- `next/navigation`: `useRouter`, `usePathname` (routing), `Link` (nav)
- `lucide-react`: icons on Side pills/sheets/nav
- `window.localStorage` + `storage` event: persistence + cross-tab sync

### 10.2 Backend
- Django model choices (`TextChoices` / `choices=` tuples)
- DRF views accept/emit side in payloads (post/feed/sets/etc.)

