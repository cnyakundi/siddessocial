# Siddes — Functional Debug Master Report (Single Source of Truth)
**Date:** 2026-01-25  
**Source snapshot:** `sidesroot_source_of_truth_clean_20260125_115706.zip` (latest zip you uploaded)

This document consolidates the “Functional Debug” work across multiple chat windows into **one** coherent status + next-step plan, using the latest zip as the source of truth.

---

## 0) What we were doing (mission)
We’re running a **wiring-first** audit to eliminate “UI lies”:
- clicks that do nothing
- UI state changes that don’t persist
- wrong endpoints/payloads/headers
- backend success but stale UI (cache/invalidation)
- permission mismatch (UI shows action → API rejects)
- realtime/event sync gaps
- edge cases (empty state, deleted resources, slow network, offline)

We’re debugging in **Parts**, end-to-end, with evidence (console + network + backend logs).

---

## 1) Current blockers (must fix before continuing)
### 1.1 Frontend typecheck is blocked (Inbox thread)
**Symptom:** `Cannot find name 'ac'`  
**Where:** `frontend/src/app/siddes-inbox/[id]/page.tsx`

**Evidence in latest zip (approx):**
- Thread-load effect uses: `signal: ac.signal` (line ~479)
- `const ac = new AbortController();` exists **only inside** a *different* effect (mentions effect), not in thread-load effect scope
- Therefore `ac` is undefined in the thread loader → TypeScript fails.

**Impact:** You can’t trust any subsequent fixes until `npm run typecheck` is green.

---

### 1.2 Tooling misconfig: `python` not found (local machine)
Your terminal output shows: `python: command not found`.  
Some apply-helper scripts expect `python` or `python3`.

**Fix options (pick one):**
- Install python: `brew install python`
- Or alias: `echo 'alias python=python3' >> ~/.zshrc && source ~/.zshrc`

---

## 2) What’s been done (confirmed in latest zip)
This section is based on **code present in the latest zip**, not on chat history.

### 2.1 Sets improvements (Part 8 — mostly done on frontend)
✅ **Frontend** now handles “private/not found” Set truth:
- `frontend/src/lib/setsProviders/backendStub.ts`:
  - `get()` treats `{restricted:true}` + missing item as `null` (private/not found)
  - `events()` treats `{restricted:true}` as `[]`

✅ **Sets changed → UI refresh**:
- Sets list page emits `emitSetsChanged()` after create.
- Top bars subscribe to `onSetsChanged()` and refetch sets list.
- Top bars auto-clear dead set scope so the UI doesn’t get stuck on deleted/left Sets.
- BottomNav recomputes Create href on audience + sets changes, so Create doesn’t keep pointing at dead sets.

✅ **Set hub error messaging**:
- `/siddes-sets/[id]` shows: “Set not found or private…” (truthful UX).

### 2.2 Hide/Delete wiring exists on Post actions
✅ In `frontend/src/components/PostCard.tsx`, the Post actions sheet includes:
- hide/unhide via `/api/hidden-posts`
- delete via `DELETE /api/post/:id`
…and has toast feedback.

> Note: there are still stale UI issues due to missing feed invalidation strategy (see remaining).

---

## 3) What is still incomplete / broken (by Functional Debug Part)
Below is the **Part-by-Part** status using the same structure we defined in your “QA assassin” workflow.

### Part 1 — Connectivity + Auth + Proxy sanity
**Status:** ⚠️ Partial  
- Proxy scaffolding is present and robust (`frontend/src/app/api/auth/_proxy.ts`).
- **Not fixed:** localhost prod-mode cookie persistence guard is NOT present.
  - `frontend/src/app/api/auth/_cookie.ts` still uses: `secure: process.env.NODE_ENV === "production"`.

**Risk:** `next build && next start` on `http://localhost` can cause “login succeeds but session doesn’t persist”.

---

### Part 2 — Feed read path (load + paginate + Set/Topic scope + scroll restore)
**Status:** ❌ Not complete (UI can lie)

**Evidence in latest zip:**
- `frontend/src/components/SideFeed.tsx`
  - imports `subscribeAudienceChanged` but only occurs once (import only) → no subscription
  - `useReturnScrollRestore()` exists only in **EmptyState** → scroll restore fails when feed has posts

**Impact:**
- TopBar Set selection can change header state but feed doesn’t refetch with `set=...`.
- Back-to-feed scroll restore works only when feed is empty.

---

### Part 3 — Post interactions (Like/Repost/Quote/Edit/Delete/Hide/etc.)
**Status:** ⚠️ Partial  
- Hide + Delete exist (see “done”).
- **Repost/Quote is still dead/unreachable**:
  - `EchoSheet` exists, but there is no code path that sets `openEcho=true`.
  - `PostActionsSheet` is rendered without `onEcho`, so the “Repost” entry is not exposed.

**Impact:** UI advertises capability but feature can be unreachable or missing.

---

### Part 4 — Post detail + replies
**Status:** ⚠️ Partial  
- Replies UI exists.
- **Nested reply UI lie is still present:**
  - `frontend/src/app/siddes-post/[id]/page.tsx` renders “Reply” button for replies even when `depth > 0`.
  - Backend enforces max nesting → attempts to reply to nested replies will fail (`parent_too_deep`).

**Impact:** user can click an action that backend will always reject.

---

### Part 5 — Compose (audience truth + submit truth)
**Status:** ❌ Not complete

**Evidence in latest zip (`frontend/src/app/siddes-compose/client.tsx`):**
- `emitAudienceChanged` is not used → audience changes aren’t broadcast/persisted to feed/topbar.
- `mediaFailed` is computed, but `canPost` does NOT include it:
  - `const canPost = hasDraft(text) && !posting && !overLimit && !mediaBusy;`

**Impact:**
- “I posted but I can’t see it” due to scope mismatch after returning to feed.
- Failed attachments can be silently dropped.

---

### Part 6 — Media pipeline (sign-upload + commit + serve)
**Status:** ❌ Not complete (hard broken)

**Evidence in latest zip:**
- Missing Next BFF routes: `frontend/src/app/api/media/*` does NOT exist.
  - Client calls `/api/media/sign-upload` and `/api/media/commit` will 404.
- `/m/<key>` route does not handle `{restricted:true}` payloads explicitly.
  - Private media may look like 200 “not_found” (truth bug).

---

### Part 7 — Profile (other user) + “public posts not visible”
**Status:** ❌ Not complete

**Evidence in latest zip:**
- Backend `ProfileView` swallows post hydration exceptions and returns empty posts:
  - `backend/siddes_prism/views.py` has broad exception handling around profile post hydration.
- There is no `postsError` / no debug counters for token mismatch.

**Impact:** UI cannot distinguish “no posts” vs “posts retrieval broken”, matching your complaint.

---

### Part 8 — Sets (backend ownership + update)
**Status:** ⚠️ Partial (frontend mostly done; backend needs one more fix)

**Evidence:**
- Backend delete appears alias-aware (`owner_id__in` exists somewhere), but:
- Backend `update()` is still strict:
  - `SiddesSet.objects.get(id=set_id, owner_id=owner_id)`

**Impact:** UI may show “owner” but save fails when owner token stored as `@handle` and session truth is `me_<id>`.

---

## 4) Standing “multi-window” misconfig problems (what’s causing chaos)
### 4.1 Multiple windows = multiple conflicting sources of truth
You’ve been running patches/instructions in parallel. This creates:
- partially applied fixes
- duplicated backup folders
- inconsistent instructions (“cd /path/to/your/sidesroot” copy-pasted)
- diverging branches

**Policy going forward (recommended):**
- Treat the latest zip (or one branch) as the ONLY source-of-truth.
- Apply fixes in numbered order, one small batch at a time.
- After each batch, run: `npm run typecheck` and `npm run build`.

### 4.2 Copy-paste pitfalls
- If you paste lines that start with `#` into zsh as commands, it can run weirdly.
- Don’t copy placeholder paths like `/path/to/your/sidesroot`.

**Always use your real repo path:**
`/Users/cn/Downloads/sidesroot`

---

## 5) Single Unified Next Plan (do this, in this order)
This is the one “combined” plan to proceed without window conflicts.

### Step 0 — Clean working state
```bash
cd /Users/cn/Downloads/sidesroot
git status -sb
```
If it’s messy, commit or stash before proceeding.

### Step 1 — Unblock TypeScript (Inbox ac fix)
Fix the `ac` AbortController scope in the thread-load effect.
Then:
```bash
cd frontend
npm run typecheck
```

### Step 2 — Feed truth (Part 2)
- subscribe to TopBar audience events
- fix scroll restore for non-empty feeds
- add regression test

Then:
```bash
cd frontend
npm run typecheck
npm run build
npx playwright test tests/e2e/feed_scope_sync.spec.ts
```

### Step 3 — Compose truth (Part 5)
- persist + broadcast Set/Topic selection
- include `mediaFailed` in `canPost` guard (no silent drop)

### Step 4 — Media pipeline (Part 6)
- add Next BFF routes `/api/media/sign-upload` and `/api/media/commit`
- fix `/m/<key>` restricted handling

### Step 5 — Profile posts truth (Part 7)
- stop swallowing profile posts errors silently
- return `postsError` + (debug-only) token mismatch counters

### Step 6 — Post actions completeness (Part 3)
- wire “Repost / Quote” entrypoint (expose EchoSheet via PostActionsSheet)
- add feed invalidation strategy (avoid stale UI after hide/mute/block/echo)

### Step 7 — Replies nesting truth (Part 4)
- hide Reply button for nested replies (depth>0)
- map backend error reason to user-friendly message

### Step 8 — Sets backend update alias-awareness (Part 8)
- make `update()` alias-aware (owner_id in viewer aliases)

---

## 6) Verification gates (do not skip)
After each Step:
1) `./verify_overlays.sh`  
2) `cd frontend && npm run typecheck`  
3) `cd frontend && npm run build`  
4) Run the target Playwright test for that part (when added)  
5) If backend changes: `docker compose ... exec backend python manage.py test` (or at least compile)

---

## Appendix — Key file pointers (latest zip)
- Inbox thread TS error: `frontend/src/app/siddes-inbox/[id]/page.tsx` (thread load uses `ac.signal` without local `ac`)
- Feed scope sync missing subscription: `frontend/src/components/SideFeed.tsx` (imports `subscribeAudienceChanged` but doesn’t subscribe)
- Scroll restore only in EmptyState: `frontend/src/components/SideFeed.tsx` (EmptyState contains `useReturnScrollRestore()`)
- Compose doesn’t broadcast audience: `frontend/src/app/siddes-compose/client.tsx` (no `emitAudienceChanged`)
- Compose can silently drop failed media: `client.tsx` (`canPost` doesn’t include `mediaFailed`)
- Missing Next media routes: `frontend/src/app/api/media/*` (directory absent)
- `/m` restricted handling missing: `frontend/src/app/m/[...key]/route.ts` (no `data.restricted` handling)
- Profile posts swallow errors: `backend/siddes_prism/views.py` (ProfileView posts hydration `except Exception`)
- Sets backend update strict owner: `backend/siddes_sets/store_db.py` (`update()` strict owner_id match)

---
