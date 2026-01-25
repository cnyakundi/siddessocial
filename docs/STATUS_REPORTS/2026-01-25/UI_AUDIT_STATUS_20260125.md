# Siddes — UI Audit Consolidated Status (as of 2026-01-25)

**Source of truth:** `sidesroot_source_of_truth_clean_20260125_121450.zip`  
**Goal:** A ruthless, detail-obsessed UI audit + polish pass, shipped in safe parts (one building block at a time), with strict safety/clarity/a11y standards.

---

## 1) What we were doing (the UI Audit mission)

We’re running a structured UI program:

- **Part 0:** Map the platform (routes + shared chrome + global patterns), define the rubric, and plan the parts.
- **Parts 1→10:** Execute building-block-by-building-block with:
  - P0/P1/P2 findings
  - exact component/file fixes
  - acceptance checks + smoke tests
  - consistency rules (“how we build UI from now on”)

---

## 2) What’s already done (confirmed in this zip)

### ✅ Part 2 — Feed / Now (audience correctness + stability)
**Evidence:** `frontend/src/components/SideFeed.tsx` now imports and uses the audience bus (`subscribeAudienceChanged`, stored last set/topic).  
**Outcome:** Top-bar Set selection and the feed are now aligned (scope changes actually change results).

Key files:
- `frontend/src/components/SideFeed.tsx`
- `frontend/src/components/PostCard.tsx`
- `frontend/src/components/FeedComposerRow.tsx`

---

### ✅ Part 3 — Compose (safety + focus/scroll correctness baseline)
**Evidence:** `frontend/src/hooks/useFocusTrap.ts` exists and is used by compose-related overlays.  
**Outcome:** Compose got a real modal baseline: focus trapping + predictable Escape + scroll containment.

Key files:
- `frontend/src/hooks/useFocusTrap.ts`
- `frontend/src/app/siddes-compose/client.tsx`
- (plus related compose sheets/components)

---

### ✅ Part 4 — Post Detail + Actions (dialog standard + destructive safety)
**Evidence:** `frontend/src/components/PostActionsSheet.tsx` contains dialog semantics (`role="dialog" aria-modal="true"`) and focus trap wiring.  
**Outcome:** Post action sheets behave like real overlays; destructive actions moved toward in-product confirmations.

Key files:
- `frontend/src/components/PostActionsSheet.tsx`
- `frontend/src/components/EditPostSheet.tsx`
- `frontend/src/components/EchoSheet.tsx`
- `frontend/src/app/siddes-post/[id]/page.tsx`

---

### ✅ Part 5 — Search (topic filtering + keyboard nav + states)
**Evidence:** `frontend/src/app/siddes-search/client.tsx` includes `PUBLIC_CHANNELS`, `topic` in URL state, and `fetchPosts(useQ, useSetId, useTopic)`.  
**Outcome:** Search supports Public topic filtering and keyboard navigation.

Key files:
- `frontend/src/app/siddes-search/client.tsx`
- `frontend/src/app/siddes-search/page.tsx`

**Still missing (see “Remaining”)**: request cancellation / race-safe “latest wins”.

---

### ✅ Part 6 — Profiles (actions sheet safety)
**Evidence:** `frontend/src/components/ProfileActionsSheet.tsx` is now an in-product sheet with an internal confirm step (no `window.confirm()`), and uses `useFocusTrap`.  
**Outcome:** Profile “…” actions are safer and keyboard-accessible.

Key files:
- `frontend/src/components/ProfileActionsSheet.tsx`
- `frontend/src/components/PrismProfile.tsx` (SideWithSheet lives here)
- `frontend/src/app/u/[username]/page.tsx` (**currently broken — see misconfigs**)

---

## 3) Standing misconfigurations (must fix before continuing)

### P0 — Build-breaking: `/u/[username]` page is corrupted
**File:** `frontend/src/app/u/[username]/page.tsx`

**Evidence (line 1 and tail):**
- The file begins with a stray backslash on line 1.
- The file ends with Python remnants like `const seen = set()` and `PY`.

This will break Next build/typecheck for the whole app.

✅ **Fix plan:** restore the page from the backup created during Part 6:
- `.backup_sd_576_part6_profiles_trust_actions_a11y_20260125_121410/frontend/src/app/u/[username]/page.tsx`

---

### P0 — Invite accept route shows double chrome
**File:** `frontend/src/components/AppShell.tsx`  
**Issue:** `/invite/*` is not in `CHROME_HIDDEN_PREFIXES`, so the app chrome renders on top of the invite page’s own header (duplicate nav).

✅ **Fix plan:** add `"/invite"` to `CHROME_HIDDEN_PREFIXES`.

---

### P1 — Documentation drift (STATE.md not reflecting today’s work)
**File:** `docs/STATE.md`  
**Observed:** `**Updated:** 2026-01-19`  
This doc is used as “where we are,” but it does not include the UI audit parts applied on 2026-01-25.

✅ **Fix plan:** keep `docs/UI_AUDIT_STATUS_20260125.md` as the UI audit source-of-truth, and optionally update `docs/STATE.md` later.

---

### P1 — Overlay numbering collisions (human confusion multiplier)
This repo contains many different changes sharing the same `sd_###` number (example: multiple `.backup_sd_570_*` directories with unrelated work). This makes it extremely hard to know what “sd_570” means.

✅ **Fix plan:** reserve a dedicated range (e.g., `sd_700+`) for UI audit work going forward. Never reuse a number for a different feature.

---

## 4) Applied UI audit overlays found in this zip (evidence: backup folders)

- **sd_570** — `part2_feed_audience_sync_polish` — 2026-01-25 07:57:24 (local)
- **sd_571** — `fix_sidefeed_comment_syntax` — 2026-01-25 08:01:38 (local)
- **sd_572** — `part3_compose_safety_focus_scroll` — 2026-01-25 09:37:26 (local)
- **sd_573** — `part4_post_detail_actions_a11y` — 2026-01-25 10:43:28 (local)
- **sd_573** — `part4_post_detail_actions_a11y` — 2026-01-25 10:49:29 (local)
- **sd_701** — `fix_typecheck_inbox_move_picker_and_telemetry_events` — 2026-01-25 10:58:52 (local)
- **sd_574** — `fix_typecheck_inbox_move_picker_and_telemetry` — 2026-01-25 11:08:18 (local)
- **sd_575** — `part5_search_race_topic_a11y` — 2026-01-25 11:38:37 (local)
- **sd_576** — `part6_profiles_trust_actions_a11y` — 2026-01-25 12:14:10 (local)

---

## 5) What’s remaining (UI Audit roadmap)

### Part 1 — Global Chrome & Navigation (NOT DONE yet in code)
We still need to standardize:
- chrome visibility rules (including `/invite/*`)
- z-index ladder for sheets/drawers/toasts
- safe-area + bottom-reserve correctness (Create button overhang)
- skip-to-content
- consistent focus-visible rings in chrome
- unified dialog primitives applied everywhere (not only some sheets)

---

### Part 5 — Search (finish it properly)
- **Race-safe search**: add cancellation / “latest request wins” gating (currently missing).
- Improve error recovery + skeleton consistency.

---

### Part 7 — Inbox + Notifications (next major block)
- Thread list density, unread clarity, empty/loading/error/offline states
- Keyboard nav and focus management
- Move-thread-to-side UX (now present and needs polish)

---

### Parts 8–10
- Sets
- Settings + Safety
- Moderation/Admin + internal tools

---

## 6) “One repo / one truth” workflow (to stop window misconfig chaos)

1) Keep **one** folder as the active repo (your latest zip extract).  
2) Always run from repo root:
   ```bash
   pwd
   git status -sb  # if .git exists; zips often omit it
   ./verify_overlays.sh
   ```
3) Apply **one** helper script at a time; after each:
   ```bash
   cd frontend && npm run typecheck && npm run build
   ```
4) If your prompt shows `... frontend %`, **do not** run `cd frontend` again—just run `npm ...`.

---

## 7) Immediate next action (before we continue Parts)
- Fix the two P0 misconfigs:
  1) restore `/u/[username]` page from backup
  2) hide chrome on `/invite/*` in `AppShell.tsx`
- Re-run `npm run typecheck` + `npm run build`
- Then we continue with the next part (Inbox + Notifications)

