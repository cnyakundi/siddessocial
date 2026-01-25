# UI Alignment Status Report (Snapshot: sidesroot_source_of_truth_clean_20260125_115706.zip)

**Date:** 2026-01-25  
**Scope:** UI “Laws & Quality Blueprint” alignment workstream (docs + accessibility + overlays + state truth).  
**Goal:** Get Siddes to a **single, consistent, accessible, trust-safe UI system** that cannot drift.

---

## 1) What this workstream is (what we’re doing)

We are executing the **UI Laws & Quality Blueprint** as a structured implementation pipeline:

1. **Phase 0 — Governance:** create the single source of truth docs + a compliance tracker.
2. **Phase 1 — Foundation:** fix high-impact accessibility (forms + focus) and overlay reliability (dialog semantics, ESC, scroll lock, focus trap/restore).
3. **Phase 2 — States Matrix:** unify Loading/Empty/Error/Restricted/Offline across core screens (no blank/lying UI).
4. **Phase 3 — Token Enforcement:** stop visual drift forever (background/radii/shadows/buttons/inputs) with guardrail scripts.
5. **Phase 4 — Trust Cues:** lock “who sees this?” cues + prevent accidental widening.
6. **Phase 5 — Performance Feel:** prevent layout shift/jank; skeleton parity; smooth scrolling.
7. **Phase 6 — Release Gates:** automation so regressions fail tests, not users.

---

## 2) What is already done (from this snapshot)

### ✅ Phase 0 — Governance docs exist
Present in `docs/`:
- `docs/UI_LAWS_BLUEPRINT.md`
- `docs/MASTER_IMPLEMENTATION_RUNBOOK.md`
- `docs/UI_COMPLIANCE_TRACKER.md`

These establish “100% aligned” as a measurable checklist, not a feeling.

### ✅ Overlay foundation exists
- `frontend/src/hooks/useDialogA11y.ts` exists (focus capture/restore + focus trap + optional ESC close).

### ✅ Overlay Contract applied to some core overlays
These currently have `role="dialog"` and `aria-modal="true"`:
- `frontend/src/components/SetPickerSheet.tsx` ✅ (also uses `useDialogA11y`)
- `frontend/src/components/SideSwitcherSheet.tsx` ✅ (also uses `useDialogA11y`)
- `frontend/src/components/NotificationsDrawer.tsx` ✅ (uses `useDialogA11y` + unified scroll lock)
- `frontend/src/components/DesktopSearchOverlay.tsx` ✅ (uses `useDialogA11y`)

### ✅ Forms A11y partially applied
Aligned (labels + focus-visible ring):
- `frontend/src/app/signup/page.tsx` ✅
- `frontend/src/app/forgot-password/page.tsx` ✅
- `frontend/src/app/siddes-profile/account/email/page.tsx` ✅
- `frontend/src/app/siddes-profile/account/password/page.tsx` ✅

---

## 3) Standing misconfigurations (must fix before we proceed)

These are the *current blockers* for “100% aligned Foundation (Phase 1)”:

### ❌ A) Login page not aligned (Forms A11y gap)
File: `frontend/src/app/login/page.tsx`

Issues:
- Missing label associations (`htmlFor` + input `id`)
- Inputs still use `outline-none` without a `focus-visible` ring
- Error not tied to inputs via `aria-describedby` / `aria-invalid`

### ❌ B) Reset password page not aligned (Forms A11y gap)
File: `frontend/src/app/reset-password/page.tsx`

Issues:
- Missing label associations (`htmlFor` + input `id`)
- Inputs still use `outline-none` without `focus-visible` ring
- Mismatch message not tied to confirm field (needs `id` + `aria-describedby`)

### ❌ C) PostActionsSheet dialog semantics exist but focus contract is missing
File: `frontend/src/components/PostActionsSheet.tsx`

Issues:
- It has `role="dialog"` + `aria-modal`, but **does not call** `useDialogA11y(...)`
- Manual ESC handler exists (redundant once the hook is used)
- Without focus trap/restore, keyboard users can “fall behind” the sheet

**Fix path:** apply the hotfix script we already prepared (sd_703).

---

## 4) What is still incomplete (remaining work)

### Phase 1B — Overlay Contract not applied to 14 sheets + 2 desktop overlays

#### Sheets missing dialog semantics (14)
These files currently do **NOT** have `role="dialog"` / `aria-modal` / focus trap:
- `frontend/src/components/ChipOverflowSheet.tsx`
- `frontend/src/components/CreateSetSheet.tsx`
- `frontend/src/components/EchoSheet.tsx`
- `frontend/src/components/EditPostSheet.tsx`
- `frontend/src/components/ImportSetSheet.tsx`
- `frontend/src/components/Invites/InviteActionSheet.tsx`
- `frontend/src/components/PeekSheet.tsx`
- `frontend/src/components/ProfileActionsSheet.tsx`
- `frontend/src/components/PublicChannelPrefsSheet.tsx`
- `frontend/src/components/PublicEnterConfirmSheet.tsx`
- `frontend/src/components/PublicTuneSheet.tsx`
- `frontend/src/components/RitualCreateSheet.tsx`
- `frontend/src/components/RitualSheet.tsx`
- `frontend/src/components/SuggestedSetsSheet.tsx`

#### Desktop overlays missing dialog semantics (2)
- `frontend/src/components/DesktopUserMenu.tsx`
- `frontend/src/components/DesktopButlerTray.tsx`

**Fix path:** apply the remaining overlay script (sd_704) after sd_703.

---

### Phase 2 — States Matrix (not started in this snapshot)
Core screens still use text-only loading, missing Retry, and “no-lies” isn’t enforced yet.

Key targets:
- Search: `frontend/src/app/siddes-search/client.tsx`
- Inbox list/thread: `frontend/src/app/siddes-inbox/page.tsx`, `frontend/src/app/siddes-inbox/[id]/page.tsx`
- Sets: `frontend/src/app/siddes-sets/page.tsx`, `frontend/src/app/siddes-sets/[id]/page.tsx`
- Profiles: `frontend/src/app/siddes-profile/page.tsx`, `frontend/src/app/u/[username]/page.tsx`

---

### Phase 3 — Token Enforcement (not started in this snapshot)
Confirmed drift that will be addressed:
- Background mismatch: `frontend/src/components/AppShell.tsx` uses `bg-[#F8F9FA]` while `globals.css` uses `#f9fafb`.
- Custom radii `rounded-[…]` exist in 11 files (most allowed exceptions; 2 should normalize later):
  - `frontend/src/components/SideSwitcherSheet.tsx` (normalize later)
  - `frontend/src/components/NotificationsDrawer.tsx` (normalize later)

---

## 5) “Multiple windows” problem — the real cause + how we stabilize

### What’s causing the mess
When you have multiple code windows/sessions, the repo becomes:
- **dirty** (generated artifacts, tmp directories, half-applied changes)
- hard to know which branch is truth
- scripts refuse to run (to protect you)

### Stabilization rule (one truth)
From now on, the alignment work should:
- run only on **one branch**: `ui/quality-bootstrap`
- be applied via **one script at a time** (autostash + commit + tests)
- produce one clean “source-of-truth” zip from that branch only

### Repo hygiene note (important)
This snapshot contains `.tmp_sd_*` scratch directories and Playwright outputs.  
Even if `.gitignore` contains them, they can still create confusion and bloated zips.

**Policy moving forward:** before sending any new zip, run a quick cleanup (remove tmp/backup/test artifacts) or zip with excludes.

---

## 6) Recommended next steps (single unified path)

### Step 1 — Fix standing misconfigs (Forms + PostActionsSheet)
Run: **sd_703_alignment_audit_hotfix_apply_helper.sh**
- Fixes login + reset-password a11y gaps
- Wires PostActionsSheet to useDialogA11y (focus trap/restore + ESC)

### Step 2 — Apply Overlay Contract to remaining overlays
Run: **sd_704_overlay_contract_remaining_apply_helper.sh**
- Adds dialog semantics + scroll lock + focus trap/restore + ESC for the remaining 14 sheets
- Adds dialog semantics + focus safety for DesktopUserMenu + DesktopButlerTray

### Step 3 — Move to Phase 2 (States Matrix)
Next after overlays are stable:
- “No-lies” loading for inbox thread
- Search skeleton + error+retry
- Sets skeletons + retry
- Profile skeleton + retry
(We’ll package this as a single script after Steps 1–2 pass.)

---

## 7) Quick validation checklist (after each step)

After any alignment script:
1) `./scripts/run_tests.sh`
2) If UI touched: `cd frontend && npm run e2e` (recommended)

Manual smoke (5 minutes):
- Open a sheet (Post actions, Set picker): **ESC closes**, **Tab stays inside**, **close returns focus**
- Login/reset password: label click focuses field; keyboard focus ring visible; errors readable
- Desktop search overlay: opens, keyboard focus stays inside, ESC closes

---

## 8) Current “alignment scorecard” (summary)

**Phase 0 — Governance:** ✅ Done  
**Phase 1A — Forms A11y:** 🟡 Partial (login + reset-password pending)  
**Phase 1B — Overlay Contract:** 🟡 Partial (14 sheets + 2 desktop overlays pending; PostActionsSheet focus trap pending)  
**Phase 2 — States Matrix:** ❌ Not started  
**Phase 3 — Token Enforcement:** ❌ Not started  
**Phase 4 — Trust Cues:** ❌ Not started (some existing features; not standardized/verified yet)  
**Phase 5 — Performance Feel:** ❌ Not started  
**Phase 6 — Release Gates:** ❌ Not started

---

## Appendix: Focus visibility drift (informational)

There are **34** current TSX files using `outline-none` (excluding backups).  
High-impact ones in app routes include:
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/reset-password/page.tsx`
- `frontend/src/app/confirm-delete/page.tsx`
- `frontend/src/app/confirm-email-change/page.tsx`
- `frontend/src/app/verify-email/page.tsx`
- `frontend/src/app/siddes-search/client.tsx`
- `frontend/src/app/siddes-inbox/page.tsx`
- `frontend/src/app/siddes-inbox/[id]/page.tsx`
- `frontend/src/app/siddes-sets/page.tsx`
- `frontend/src/app/siddes-sets/[id]/page.tsx`
- `frontend/src/app/siddes-compose/client.tsx`
- `frontend/src/app/siddes-post/[id]/page.tsx`

This will be addressed progressively (starting with auth + overlays; then broader app surfaces).

