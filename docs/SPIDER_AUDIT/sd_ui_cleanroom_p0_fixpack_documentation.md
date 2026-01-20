# UI CLEANROOM — P0 Fix Pack Documentation

> **Fix Pack ID (suggested):** `sd_430_ui_cleanroom_p0_threshold_nav_safety_v0.10.0`
>
> **Summary:** Unify the “Threshold” (Public entry confirm everywhere), remove Chameleon color leaks, reduce mis‑taps (44×44 targets), and make **Sets** a first‑class nav surface on mobile.

---

## 0) What this fix pack is

This is a **P0 UI safety + clarity** fix pack.

It does **not** attempt to redesign Siddes. It removes the highest-risk UX inconsistencies that can cause:
- accidental entry into **Public** (mis‑post risk)
- accidental likes/taps (mis‑tap risk)
- diluted brand meaning (Chameleon color leakage)
- nav confusion (“Sets is primary on desktop but hidden on mobile”)

---

## 1) Goals

### G1 — Reduce user confusion + mis‑taps
- Standardize icon button hit targets to **≥ 44×44** everywhere.
- Make Side switching behavior uniform regardless of where the switch is triggered.

### G2 — Enforce brand meaning through consistent visual language
- Side colors are **reserved for Side meaning**.
- Remove Side colors from avatar palettes and unrelated decorative accents.

### G3 — Improve speed + perceived performance (UI-level)
- Reduce “mental latency”: no surprises when Public is involved.
- Keep the UI responsive by preventing extra confirm flows / duplicate modals.

### G4 — Healthy habit loop
- Strengthen the **Threshold Moment**: switching into Public is always deliberate.
- Keep interaction feedback calm (no dopamine tricks).

---

## 2) Scope

### In scope (P0)
1) **One canonical Side switch API**
   - Introduce `requestSide(nextSide)` that guarantees Public confirm.
   - Route all user-triggered Side switches through it.

2) **Public confirm de-dup**
   - Remove per-component Public confirm logic (BottomNav / SideSwitcherSheet / DesktopSideRail).
   - Keep route-level Public gating where necessary (Public-only pages like Broadcasts) *only if they’re enforcing access by route*.

3) **PostCard ergonomics + Chameleon cleanup**
   - Like button uses `ACTION_BASE` (44×44) like the other actions.
   - Echo uses **Public blue** semantics (no emerald).
   - Avatar palette removes Side colors (no blue/emerald/rose/slate/sky).

4) **Navigation parity**
   - Make **Sets** a primary destination on mobile BottomNav.
   - Fix BottomNav “Public active” state so it never highlights Public unless Public is truly active.

5) **Icon collision removal**
   - Stop using the **Users** icon for both Friends Side and Sets.

6) **Copy tweaks for safety clarity**
   - Make Public confirm copy sharper and less ambiguous.
   - Rename “To:” in composer header to **Audience:**.

### Not in scope (explicitly)
- Any backend/API changes.
- Activity polling redesign (`/api/activity` consolidation) — that’s a P1.
- Large visual restyles, typography resets, or layout rewrites.
- “Never ask again” changes to Public post confirmation (we’ll document, but not change in this pack unless requested).

---

## 3) Implementation plan (ship-ready)

### 3.1 Add a single Side switch gateway

**Target:** `frontend/src/components/SideProvider.tsx`

Add to the Side context:
- `requestSide(next: SideId, opts?: { after?: () => void; cancel?: () => void })`
- (optional) `setSideUnsafe(next: SideId)` for internal restores

**Behavior:**
- If `next !== "public"` → set immediately.
- If `next === "public"` and current side isn’t public → open a single global `PublicEnterConfirmSheet`.
- Confirm → sets side to public, closes sheet, calls `after()`.
- Cancel → closes sheet, calls `cancel()`.

**Why provider-level?**
- Removes copy/paste confirm implementations.
- Makes Public entry consistent in every surface (TopBar, SideBadge, BottomNav, Compose suggestions, deep-link banners, etc.).

**Note:** Route-level gating can still exist for Public-only routes; those can call `requestSide("public", { after: ... , cancel: ... })` instead of `setSide`.

---

### 3.2 Replace direct `setSide(...)` calls (user-triggered)

#### AppTopBar
**File:** `frontend/src/components/AppTopBar.tsx`
- Replace `setSide(nextSide)` in SideSwitcherSheet handler with `requestSide(nextSide)`.

#### SideChrome
**File:** `frontend/src/components/SideChrome.tsx`
- Replace `setSide(nextSide)` in SideSwitcherSheet handler with `requestSide(nextSide)`.

#### SideSwitcherSheet
**File:** `frontend/src/components/SideSwitcherSheet.tsx`
- Remove internal `confirmPublic` state + inline `PublicEnterConfirmSheet` usage.
- Call the new `requestSide(nextSide)` and then close the sheet.

#### BottomNav
**File:** `frontend/src/components/BottomNav.tsx`
- Remove local `confirmPublic` state + inline `PublicEnterConfirmSheet`.
- Replace `goPublic` logic with `requestSide("public", { after: () => router.push("/siddes-feed") })`.
- Replace “Home while in Public returns to last non-public side” by calling `requestSide(lastNonPublic)`.

#### DesktopSideRail
**File:** `frontend/src/components/DesktopSideRail.tsx`
- Remove local confirm sheet and local `requestSide` implementation.
- Use the provider `requestSide(next)`.

#### FirstRunSidePicker
**File:** `frontend/src/components/FirstRunSidePicker.tsx`
- Replace all `setSide(...)` user clicks with `requestSide(...)`.
- Optional safety: suppress FTUE picker on onboarding routes (if `/onboarding` exists and sets default side there).

#### Compose
**File:** `frontend/src/app/siddes-compose/client.tsx`
- Deep-link banner button (“Enter {Side}”) must use `requestSide(requestedSide)`.
- `ComposeSuggestionBar` `onApplySide` must use `requestSide(s)`.

#### Post detail (Enter Side button)
**File:** `frontend/src/app/siddes-post/[id]/page.tsx`
- Replace `setSide(postSide)` in `enterSide()` and `SideMismatchBanner` with `requestSide(postSide)`.
- Must trigger Public confirm when target is Public.


---

### 3.3 Fix PostCard mis‑taps + Chameleon leakage

**File:** `frontend/src/components/PostCard.tsx`

1) **Like button hit target**
- Replace `p-1` with `ACTION_BASE` so Like is 44×44 like Reply/Echo/Share.

2) **Echo color semantics**
- Echo is Public-only; it must not use emerald.
- Use Public theme text (`SIDE_THEMES.public.text`) and Public hover (`hover:text-blue-600`) when `side === "public"`.

3) **Avatar palette**
- Replace avatar color classes that overlap Side colors.
- Allowed palette examples: amber / violet / teal / fuchsia / lime / orange / stone / zinc.
- Disallowed: blue/sky/indigo, emerald/green, rose/pink/red, slate/gray variants that read as Work.

---

### 3.4 Navigation parity + icon collision

#### BottomNav: make Sets primary
**File:** `frontend/src/components/BottomNav.tsx`
- Replace “Me” with “Sets”:
  - Icon: `Grid3X3` (or `Layers`) — **not** `Users`.
  - Link: `/siddes-sets`.
- Profile remains accessible from the TopBar account menu (`DesktopUserMenu` already links it).

#### BottomNav: Public active semantics
- Current issue: Public highlights on `/siddes-broadcasts` even when side isn’t Public.
- Fix:
  - `publicActive = side === "public" && (isFeed || isBroadcasts)`

#### DesktopSideRail: Sets icon
**File:** `frontend/src/components/DesktopSideRail.tsx`
- In `PRIMARY_NAV`, change Sets icon from `Users` to `Grid3X3` (or `Layers`).

---

### 3.5 Copy tweaks (safety clarity)

#### Public enter confirm
**File:** `frontend/src/components/PublicEnterConfirmSheet.tsx`
- Replace:
  - “Public is visible to anyone.”
- With:
  - **“Public = anyone can see this. No take-backs.”**

#### Composer audience label
**File:** `frontend/src/app/siddes-compose/client.tsx`
- Replace “To:” with **“Audience:”** in the audience chip.

---

## 4) Planned file list (overlay manifest)

- `frontend/src/components/SideProvider.tsx`
- `frontend/src/components/SideSwitcherSheet.tsx`
- `frontend/src/components/SideChrome.tsx`
- `frontend/src/components/AppTopBar.tsx`
- `frontend/src/components/BottomNav.tsx`
- `frontend/src/components/DesktopSideRail.tsx`
- `frontend/src/components/FirstRunSidePicker.tsx`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/app/siddes-post/[id]/page.tsx`
- `frontend/src/components/PostCard.tsx`
- `frontend/src/components/PublicEnterConfirmSheet.tsx`

(If Broadcast routes are updated to call `requestSide` instead of inline setSide, include:)
- `frontend/src/app/siddes-broadcasts/page.tsx`
- `frontend/src/app/siddes-broadcasts/create/page.tsx`
- `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
- `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`

---

## 5) Apply instructions (VS Code terminal)

If delivered as an **overlay zip**:

```bash
chmod +x scripts/apply_overlay.sh
./scripts/apply_overlay.sh ~/Downloads/sd_430_ui_cleanroom_p0_threshold_nav_safety_v0.10.0.zip
./verify_overlays.sh
./scripts/run_tests.sh
```

If delivered as a **single apply-helper script** (preferred workflow):

```bash
chmod +x ~/Downloads/sd_430_ui_cleanroom_p0_threshold_nav_safety_apply_helper.sh
~/Downloads/sd_430_ui_cleanroom_p0_threshold_nav_safety_apply_helper.sh

cd frontend && npm run typecheck
cd frontend && npm run build
```

---

## 6) Verification

### Automated
From repo root:

```bash
cd frontend && npm run typecheck
cd frontend && npm run build
```

(Optional full suite)

```bash
./scripts/run_tests.sh
```

### Manual QA script (must-pass)

1) **Threshold — Public entry confirm (everywhere)**
- From Friends → tap Public in BottomNav → confirm sheet appears → Cancel keeps you in Friends.
- From Friends → tap SideBadge → choose Public → confirm sheet appears.
- From Friends → open Compose → suggestion chip “Public” → confirm sheet appears.
- From Friends → open Compose deep-link banner “Enter Public” → confirm sheet appears.

2) **Public active state correctness**
- While in Friends, navigating to any Public-only route should not permanently show Public active until confirm.
- After confirming Public, Public tab highlights correctly.

3) **PostCard tap targets**
- Like icon has the same hit target feel as Reply/Echo.
- Keyboard: each action shows focus ring when tabbed.

4) **Echo semantics**
- In Public feed, Echo highlight is Public-blue, not emerald.

5) **Chameleon avatar palette**
- Avatars no longer use Side-reserved colors (no blue/emerald/rose/slate families).

6) **Navigation parity**
- Sets is reachable in one tap from BottomNav (mobile).
- Desktop Sets icon no longer collides with Friends icon.

---

## 7) Acceptance criteria (Definition of Done)

### Side switching
- ✅ No user-triggered path can switch into Public without showing `PublicEnterConfirmSheet` first.
- ✅ Cancel never changes the active Side.
- ✅ Confirm always results in `sd.activeSide === "public"` and updates UI chrome to Public tokens.

### Chameleon
- ✅ No Side color tokens are used for avatars.
- ✅ Echo uses Public semantics.

### Tap targets
- ✅ Like uses `ACTION_BASE` and meets 44×44 target.

### Navigation
- ✅ Sets is a primary nav destination on both desktop and mobile.
- ✅ Sets icon is distinct from Friends Side icon.

---

## 8) Rollback

If using an apply-helper script, it must create a backup folder:
- `.backup_sd_430_ui_cleanroom_p0_threshold_nav_safety_<timestamp>/...`

Rollback approach:
1) Copy backed-up files back into place.
2) Re-run:
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run build`

---

## 9) Follow-on (P1 suggestions, not part of this pack)

- Consolidate side activity polling into a single endpoint (`/api/activity`) to eliminate 4× feed fetches every 5s.
- Add focus trap for all sheets/modals.
- Replace any remaining tiny label text (`text-[10px]`) on critical navigation with 12px minimum.

