# Siddes Migration Pack — Next AI Window (UI → Real Data → Launch)

**Date:** 2026-01-14  
**Purpose:** You are moving Siddes development into another AI coding chat.  
This pack tells the new AI tool the **heartbeat of the project**, what is **done**, what is **remaining**, and the **next execution plan** (kill stubs → real DB-backed mocks → clean UI).

---

## 1) Read order (new AI tool must read these first)

1. `docs/UI_LAUNCH_MVP.md` — current launch MVP shell behavior
2. `docs/STYLE_GUIDE.md` — naming + UI tone (needs more “Side/Sided/Topics” enforcement)
3. `docs/STATE.md` — current milestone and project state
4. `docs/FEED_BACKEND.md`, `docs/POST_DETAIL_BACKEND.md`, `docs/SETS_BACKEND.md`, `docs/PUBLIC_CHANNELS.md` — backend contracts
5. `docs/NEXT_DEV_CACHE.md` + `docs/PWA_PLAN.md` — caching + PWA behavior

**Important:** The team wants to add a single canonical doc pack:
- `docs/UI_HEARTBEAT.md`
- `docs/UI_MASTER_SPEC.md`
- `docs/UI_STATUS_MATRIX.md`

(There is an apply helper prepared for this: `sd_152e_apply_helper.sh`.)

---

## 2) Current UI state (what is DONE vs still stubbed)

### ✅ Done (foundation)
- Side-based UI concept is implemented across the app.
- Global shell exists:
  - Mobile header (`AppTopBar`) + Bottom nav (`BottomNav`)
  - Desktop shell now supports a responsive split (desktop rail + desktop topbar) once wired.
- Core pages exist:
  - Feed: `/siddes-feed` (`SideFeed.tsx`)
  - Sets: `/siddes-sets` (now **Suspense-wrapped** to satisfy Next build)
  - Inbox: `/siddes-inbox`
  - Profile: `/siddes-profile`
  - Invites: `/siddes-invites`
- Backend scaffold:
  - Django 5 + DRF project wiring
  - Apps exist for feed, sets, invites, inbox (mixed: some real DB, some stub stores)

### 🟡 Partial (present but not “launch clean”)
- Terminology drift:
  - UI still uses “Side/Siding” in places (must become **Side/Sided/Unside**)
- Public taxonomy drift:
  - UI copy still says **Topics** in some places; product wants **Topics** (internal detail: `publicChannel`)
- Feed modules (“stealables”):
  - Framework exists but is **flagged** and content is stubbed (OK for now)
- Media/link rules are mocked but not consistently enforced (share restrictions, autoplay rules)

### ❌ Not done (high leverage)
- Kill stubs by using “DB-backed mocks”:
  - replace in-memory/mock stores with DB models + seed scripts + real endpoints
- Side Personas (major differentiator):
  - different name/bio/avatar per Side (optional, not forced)
- Work “updates + tasks” (UI-only first, then DB):
  - Work composer with optional task fields
  - task cards
  - board toggle
- Public Topics full UI:
  - topic picker sheet + side/mute topics + trends

---

## 3) “Kill stubs” strategy (what this means practically)

**We do NOT remove all stubs at once.**  
We convert each area to “real endpoints + seeded DB data,” so the UI becomes real, stable, and testable.

### 3.1 The rule
- UI should read from real DRF endpoints.
- Dev experience should still feel “mockable” via:
  - `scripts/seed_demo_universe.sh` (or equivalent)
  - DB seed fixtures
  - predictable dev data

### 3.2 Frontend stubs to phase out (existing)
These exist today and must be phased out:
- `frontend/src/lib/feedProviders/mock.ts`
- `frontend/src/lib/feedProviders/backendStub.ts`
- `frontend/src/lib/setsProviders/backendStub.ts`
- `frontend/src/lib/inboxProviders/backendStub.ts`
- `frontend/src/lib/inviteProviders/backendStub.ts`
- `frontend/src/lib/mockFeed.ts`, `mockInbox.ts`, etc.

**Target:** keep a single provider that calls DRF (`backend`) and keep mocks only behind an explicit dev flag.

---

## 4) Backend “real data” plan (phased)

### Phase A — Feed + Post Detail (highest value)
1) Introduce DB models (if not already):
   - Post, Reply, Reaction/Like, Echo
   - Media attachment metadata (optional v0)
2) Replace feed stub/mock_db with DB queries
3) Ensure endpoints:
   - `GET /api/feed?side=&set=&topic=`
   - `POST /api/posts` (create)
   - `GET /api/post/<id>` (detail)
   - `POST /api/post/<id>/reply`
4) Add seed script:
   - creates 50 posts across sides + sets + topics

### Phase B — Sets
- Ensure Set + Membership are real (DB)
- Endpoints:
  - list sets by side
  - create set
  - add/remove members (later can be stub)
- Feed filter should query by set id

### Phase C — Invites
- Real invite model exists; finalize:
  - acceptance flow with side+set binding
  - max uses + expiry
- Seed creates a few active invites

### Phase D — Inbox
- Start with simple thread/message models (DB)
- Endpoints:
  - list threads (scoped by side)
  - list messages
  - send message

### Phase E — Public Topics
- Keep “topics” as constants at first (no DB needed)
- Implement:
  - topic preferences (side/mute)
  - trends (“Today in Public”)
- Later: DB-backed trending metrics

---

## 5) Desktop UI should be “Tumblr width”

**Problem:** Desktop currently feels too broad.  
**Goal:** Center column like Tumblr (comfortable reading width).

### 5.1 Layout spec
- Left rail: 72–80px
- Main content column max width:
  - **680px** (recommended)
  - never exceed 760px
- Keep a single column feed (no multi-column dashboard)
- Right drawer (Inbox) should be optional and not compress the feed too much

### 5.2 Implementation idea
Create a single wrapper component:
- `ContentColumn` = `w-full max-w-[680px] mx-auto px-4`

Apply to:
- Feed, Post Detail, Profile, Sets, Invites, Inbox lists

---

## 6) UI polish gates (before “final stuff”)

Before adding more features, lock these:
1) **Naming:** Side/Sided/Unside, Sets, Topics
2) **Context guard:** never cross-side reply/post without a guard
3) **Build stamp:** `/launchpad` shows build stamp so “old UI” never confuses again
4) **Docs pack:** add UI heartbeat/master spec/status matrix into repo
5) **Type + lint clean:** no build blockers; warnings acceptable but track them

---

## 7) Immediate TODO list (what the next AI tool should do)

### Must do next (week 1)
- [ ] Add UI docs pack into repo (heartbeat + master + status matrix)
- [ ] Rename Public “Topics” → “Topics” in all UI-facing strings
- [ ] Rename “Side/Siding” → “Side/Sided/Unside” in Profile + CTA components
- [ ] Implement Tumblr-width content column on desktop
- [ ] Convert Feed from stub/mock_db to DB-backed + seeded data

### Should do next (week 2)
- [ ] Side Personas v0 (optional per-side identity)
- [ ] Work extras v0 (composer + tasks + board)
- [ ] Public Topics picker sheet (side/mute topics)

### Later
- [ ] Media policies (autoplay, share restrictions, gallery)
- [ ] Full search/discover

---

## 8) “Paste into the next AI chat” starter prompt

Copy/paste this into the new AI coding tool:

> You are working on Siddes (Next.js 14 + Django 5 DRF).  
> Siddes core: Side (Public/Friends/Close/Work) → Set (subgroup) → Feed; Public has Topics (implemented internally as publicChannel).  
> You MUST keep a calm, privacy-first Chameleon UI with subtle accents.  
> Desktop must be Tumblr-width (center column max 680px).  
> Goal: remove stubs by switching UI to real DRF endpoints backed by seeded DB data.  
> Read docs first: UI_LAUNCH_MVP.md, STYLE_GUIDE.md, STATE.md, FEED_BACKEND.md, SETS_BACKEND.md, PUBLIC_CHANNELS.md, NEXT_DEV_CACHE.md, PWA_PLAN.md.  
> Next tasks: add UI docs pack (UI_HEARTBEAT/UI_MASTER_SPEC/UI_STATUS_MATRIX), rename Topics→Topics in UI, rename Side→Side/Sided/Unside, then convert feed stub/mock_db to real DB models + endpoints + seed script.  
> Do not introduce dashboards. Keep one clean column. Add context guards for cross-side actions.


