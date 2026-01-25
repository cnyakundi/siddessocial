# Siddes — Multi‑Window Status Report (Consolidated)
**Date:** 2026‑01‑25  
**Goal:** Stabilize the codebase (no misconfig drift) and ship the Privacy‑First Intelligence Layer (Compose + context‑collapse prevention) in a controlled sequence.

---

## 1) Snapshot: “Latest Zip” that was provided
**Zip:** `sidesroot_source_of_truth_clean_20260125_115706.zip`  
- **Compressed size:** ~20.7 MB  
- **Uncompressed size:** ~165.1 MB  
- **Frontend build artifacts inside zip:** `frontend/.next_build` ~156.0 MB (this is the main bloat)  
- **Backup folders inside zip:** 96 `.backup_*` directories

### Why this matters
- The zip is not truly “source-of-truth clean” yet because it includes build output (`.next_build`) and many `.backup_*` directories. These often create **misconfig drift** (old copies of files hang around, and zips get huge).

---

## 2) What Window A (AI / Intelligence Engine) was focusing on
**Core target:** An “Intelligence Layer” that improves Siddes utility without turning it into dopamine social media.

### Intended MVP behaviors (suggest‑only)
1) **Compose suggestions:** suggest Side / Set / Urgent as you type  
2) **Wrong‑audience prevention (“Side Guard”):** high‑confidence warnings before posting to the wrong Side  
3) **CCE onboarding suggestions:** suggested Sets from contact matches (review‑first)  
4) **Retrieval aids (later):** search ranking / snippets / clustering only when it improves utility

### Non‑negotiables (enforced)
- Suggest‑only by default (no silent changes)
- On‑device first; minimal server assist
- 1‑sentence explainability for every suggestion
- Reversible actions + kill switch

---

## 3) What is already present in the zip (Window A foundations)
### ✅ Docs + architecture are present
- `docs/COMPOSE_INTELLIGENCE.md`
- `docs/ML_PART_0.md`, `docs/ML_PART_1_ON_DEVICE.md`, `docs/ML_PART_2_LOCAL_CLUSTERING.md`, `docs/ML_PART_6_HUMAN_REVIEW.md`

### ✅ Local intelligence modules are present
- `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- `frontend/src/lib/localIntelligence/localSuggestedSetsCache.ts`
- `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`

### ✅ Compose intent rules engine is present
- `frontend/src/lib/composeIntent.ts`

### ✅ Compose suggestion UI component exists
- `frontend/src/components/ComposeSuggestionBar.tsx`

---

## 4) What is NOT “actually on” yet (Window A gap)
These are confirmed from the zip:

### 🚫 ComposeSuggestionBar is still hard‑hidden in compose
- `frontend/src/app/siddes-compose/client.tsx` renders `<ComposeSuggestionBar />` inside a `div` with class `hidden`.
- **Result:** intelligence exists but is invisible to users.

**Zip check:** ComposeSuggestionBar hidden = **True**

### 🚫 No compose intelligence flags in `FLAGS`
- `frontend/src/lib/flags.ts` does not include `composeSuggestions` (or Side Guard flags).

**Zip check:** flags has composeSuggestions = **False**

### 🚫 No standardized reason codes / explainability registry
- No `frontend/src/lib/intelligence/reasons.ts` in this zip.
- Suggestion UI in zip does not show “Why:” reasons.

**Zip check:** suggestion bar has why/testid = **False**  
**Zip check:** composeIntent has reasonCode = **False**

---

## 5) What we changed / produced during this work (across your windows)
### A) Intelligence Engine deliverables produced in chat
- Full Part 0–Part 12 architecture and rollout plan (Compose → Side Guard → Local clustering → Search → Butler → Moderation → Trust gates → Governance → Sync → Explainability → Telemetry → Shipping plan).

### B) Apply‑helper overlays prepared (Window A + stability)
These are the overlays we generated/proposed to keep things deterministic and beginner‑safe:

- **sd_570** — enable ComposeSuggestionBar (behind `?advanced=1` / env flag), add “Why:” line + `data-testid`
- **sd_571** — Side Guard preflight (high-confidence wrong-side warning) + confirm sheet
- **sd_572** — reason codes registry + Public trust‑gate error mapping (trust_required/link_requires_trust/rate_limited)
- **sd_573** — telemetry hardening (counts-only, panicMode respect, suggestion_shown de‑spam)

And stability/typecheck packs created while multiple windows touched the same areas:
- **sd_701–sd_705** — typecheck hotfixes (telemetry typing, inbox move picker wiring, duplicate imports) + zip hygiene (ignore .tmp, add clean_for_zip helper)

> NOTE: Your terminal output shows that multiple windows/tools touched **Inbox**, **Telemetry**, and **UI sheets** in overlapping ways. That’s the main source of “misconfiguration drift.”

---

## 6) Current blockers observed from your latest terminal output (not from the zip)
After applying sd_705, TypeScript currently fails with **5 errors**:

### 6.1 Inbox thread page
- `frontend/src/app/siddes-inbox/[id]/page.tsx`
  - `Cannot find name 'ac'`  
  → abort controller referenced but not defined in the fetch effect

### 6.2 NotificationsDrawer
- `frontend/src/components/NotificationsDrawer.tsx`
  - duplicate JSX attribute: `id="notifications-drawer-title"` appears twice

### 6.3 PostActionsSheet
- `frontend/src/components/PostActionsSheet.tsx`
  - `panelRef` missing
  - `closeBtnRef` missing
  - duplicate `id="post-actions-title"` appears twice

**Fix pack ready:** `sd_706_fix_typecheck_ac_notificationsdrawer_postactionssheet` (created in this chat).  
Applying sd_706 should bring `npm run typecheck` back to green.

---

## 7) Standing misconfigurations (root causes)
These are the patterns creating “multiple window chaos”:

1) **Zips include build artifacts** (`frontend/.next_build`) → massive bloat, stale outputs, confusion  
2) **Backups + tmp overlays included in zips** (`.backup_*`, `.tmp_sd_*`) → old copies linger  
3) **Overlapping edits across windows** (Inbox + Telemetry + UI sheets) without a clean baseline  
4) **Copy/paste duplication** in JSX (`id=...` repeated) and imports (`ensureThreadLockedSide` duplicated)  
5) **Running commands from the wrong directory**
   - Example: you ran `bash scripts/dev/clean_for_zip.sh` while inside `frontend/`, so the relative path didn’t exist.

---

## 8) One plan (“combine all windows to do one thing”)
### Step 1 — Stabilize compilation (no new features until green)
1) Apply **sd_706** (fix ac + duplicate JSX ids + missing refs)
2) Run:
   - `./verify_overlays.sh`
   - `cd frontend && npm run typecheck && npm run build`

### Step 2 — Make “source_of_truth” zips actually clean
Run from repo root:
- `bash scripts/dev/clean_for_zip.sh`

Then create zips from **tracked files only** (best practice):
- `git ls-files -z | tar --null -T - -czf ../sidesroot_clean.tgz`

### Step 3 — Resume Intelligence Engine work in order (no skipping)
Apply in this exact order (each one verified before the next):
1) **PR 12.1 / sd_570** — show Compose suggestions behind advanced/flag  
2) **PR 12.2 / sd_571** — Side Guard preflight sheet (high confidence only)  
3) **PR 12.3 / sd_572** — reason codes + Public gate mapping  
4) **PR 12.4 / sd_573** — telemetry hardening (counts-only)

After each:
- `./verify_overlays.sh`
- `cd frontend && npm run typecheck && npm run build`
- (optional) `cd frontend && npm run e2e`

### Step 4 — Update project docs so windows don’t diverge
- Update `docs/STATE.md` to today’s status (what’s stable, what’s next)
- Update `docs/OVERLAYS_INDEX.md` with the overlays applied (so “where are we?” is always answerable)

---

## 9) What remains (Window A)
### Must‑do (next)
- Fix current TS blockers (sd_706)
- Enable ComposeSuggestionBar (sd_570) so Intelligence becomes visible
- Add Side Guard preflight (sd_571) for wrong-audience prevention
- Add explainability registry + map trust gate codes (sd_572)

### Later (after MVP is stable)
- Local clustering from in-app activity (not contacts) → suggested Sets in Butler
- Search utility improvements (Recent/Relevant toggle, snippets, opt-in summaries)
- Butler “Suggestions” tab (one calm review queue)

---

## 10) Quick operational rules (prevents future “window chaos”)
- **One active window at a time** until typecheck/build is green
- **No new overlays** when working tree is red
- Every overlay ends with:
  - `./verify_overlays.sh`
  - `npm run typecheck`
  - `npm run build`
- Zips must exclude:
  - `.next*`, `.backup_*`, `.tmp_*`, `playwright-report/`, `test-results/`

---

### Appendix: What the zip shows vs what your terminal shows
- The zip snapshot still has Compose suggestions hidden and no compose flags.
- Your terminal output shows additional window work (Inbox/UI/Telemetry) that is not fully stabilized yet.
- The plan above brings everything into **one stable trunk**, then resumes Intelligence step-by-step.
