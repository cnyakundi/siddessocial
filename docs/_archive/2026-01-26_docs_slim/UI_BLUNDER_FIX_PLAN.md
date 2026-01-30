# Siddes UI Blunder Fix Plan (Fix Pack 1)

**Snapshot (source of truth ZIP):** `sidesroot_source_of_truth_clean_20260125_231224.zip`  
**Date:** 2026-01-25  
**Scope:** PWA + mobile + desktop — visible UI blunders + navigation traps.

Severity:
- **P0** = traps / broken core flows / build-syntax risk / cannot navigate
- **P1** = major UX friction (annoying, confusing, “feels broken”)
- **P2** = polish + consistency + follow-ups

---

## P0 — Must fix next

### P0.1 PostCard action/navigation block is corrupted
**Symptom class:** random behavior when tapping a post (share/copy instead of open), missing functions for profile/open/reply/actions, broken 3‑dots flow.

**Evidence (current repo):**
- `frontend/src/components/PostCard.tsx` — `const openPost = () => {` starts around line ~941.
- Inside that block, `await navigator.clipboard.writeText(absUrl);` appears even though `openPost` is not `async` (line ~962).
- `openProfile` / `doEcho` are referenced later but not defined nearby (hard fail).

**Root cause:** a previous overlay patch accidentally spliced the **share** function body into `openPost`, deleting `openProfile/openReply/doEcho/doShare` definitions.

**Fix:** restore the full **openPost/openProfile/openReply/doEcho/doQuote/doShare** block (using the last known good layout).

**Verification:**
1. `cd frontend && npm run typecheck` (must pass)
2. Feed: tap a post body → opens `/siddes-post/:id` (no “Link copied” toast).
3. Tap avatar/name/handle → opens `/u/:username`
4. Tap reply → opens post detail with reply composer
5. 3‑dots → opens PostActionsSheet, Echo/Share behave correctly

---

## P1 — High impact UX blunders

### P1.1 “Three dots” actions sheet covers the whole screen
**Symptom:** Post options sheet becomes a full-screen wall and can’t be comfortably used (no internal scroll rhythm).

**Evidence:**  
`frontend/src/components/PostActionsSheet.tsx` panel has **no** `max-h` + **no** `overflow-y-auto` on the dialog container.

**Fix:**
- Add `max-h-[85dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain` to the panel.
- (Optional later) make header sticky and scroll only the action list.

**Verification:**
- On mobile: open 3‑dots → sheet height capped; you can scroll actions inside the sheet; tapping backdrop closes.

---

### P1.2 Icons are hard to click (BottomNav tap targets too small)
**Symptom:** you “miss” taps on Now/Circles/Inbox/Me; feels like icons are broken.

**Evidence:**  
`frontend/src/components/BottomNav.tsx`:
- `TabLink` uses `<Link>` without `w-full h-full` inside an 88px-tall grid cell.
- Same problem for the Create and Me links.

**Fix:** make each nav link fill the whole cell (`w-full h-full`) and add focus outline.

**Verification:**
- On mobile/PWA: you can tap anywhere in each tab column and it navigates.
- This also makes “going back” effectively easy: tap **Now** reliably.

---

### P1.3 Compose card alignment drift vs feed rhythm
**Symptom:** the inline feed composer doesn’t line up with post cards (avatar size + gap makes the text lane start earlier than posts).

**Evidence:**  
`frontend/src/components/FeedComposerRow.tsx` uses:
- avatar `w-10 h-10`
- layout `items-end gap-2`

…but PostCard rhythm is closer to `w-12` + `gap-4`.

**Fix:**
- Make composer avatar `w-12 h-12`
- Change row alignment to `items-start gap-4`
- Keep the rest intact.

**Verification:**
- Feed: composer text lane aligns with post body lane; feels “same system”.

---

## P2 — Consistency fixes (same bug class)

### P2.1 Other bottom sheets can overflow the viewport
Same missing `max-h/overflow-y` pattern exists in:
- `frontend/src/components/ChipOverflowSheet.tsx`
- `frontend/src/components/CirclePickerSheet.tsx`
- `frontend/src/components/ProfileActionsSheet.tsx`

**Fix:** apply the same `max-h + overflow-y-auto` treatment.

---

## A tiny “Don’t ship blunders again” workflow

1) **Installed-PWA smoke test** (not just Safari/Chrome tab)
- open feed, open post, open 3‑dots, close sheets
- rotate once (portrait/landscape)
- test one-handed taps (bottom nav)

2) **One checklist for every release**
- tap targets ≥ 44×44
- any fixed overlays: must have max height + internal scroll
- every detail view must have an obvious “escape route” (Back/Home)

---

## Fix Pack 1 contents
This fix pack applies:
- PostCard restore block (P0.1)
- PostActionsSheet + related sheets max-height + scroll (P1.1, P2.1)
- BottomNav tap targets (P1.2)
- FeedComposerRow alignment (P1.3)
- Post detail “smart back” button fallback (extra safety)


