# Siddes UI Status Matrix

**Updated:** 2026-01-14  
This is a snapshot of what is implemented in the repo vs what is still stubbed or missing.

Legend:
- ✅ Done (implemented)
- 🟡 Partial (present but stubbed / needs polish / naming drift)
- ❌ Not done

---

## A) Global Shell

- ✅ Top bar / header shell — `frontend/src/components/AppTopBar.tsx`
- ✅ Bottom navigation — `frontend/src/components/BottomNav.tsx`
- ✅ Side switcher sheet — `frontend/src/components/SideSwitcherSheet.tsx`
- ✅ Peek sheet (context peek) — `frontend/src/components/PeekSheet.tsx`
- ✅ Build stamp (debug old UI) — present (see /launchpad + frontend/src/lib/buildStamp.ts)

## B) Feed

- ✅ Side feed page — `frontend/src/app/siddes-feed/page.tsx`
- ✅ SideFeed component — `frontend/src/components/SideFeed.tsx`
- ✅ PostCard component — `frontend/src/components/PostCard.tsx`
- ✅ Sets-as-filter — `SetFilterBar.tsx`, `SetPickerSheet.tsx`
- 🟡 Public Topics — implemented as public topics; UI copy still says “Topics”
- ✅ Context chips + overflow — `chips.ts`, `ChipOverflowSheet.tsx`

## C) Compose

- ✅ Compose page — `frontend/src/app/siddes-compose/page.tsx`
- ✅ Compose intent suggestions — `frontend/src/components/ComposeSuggestionBar.tsx`
- ✅ Manual Set picker — present in compose
- 🟡 Public Topic selector — present but called “Topic” in UI copy

## D) Post Detail

- ✅ Post detail page — `frontend/src/app/siddes-post/[id]/page.tsx`
- ✅ Replies composer scaffolding — present (stubbed backend ok)
- 🟡 Media polish — placeholder-level today

## E) Inbox

- ✅ Inbox list (Messages + Alerts) — `frontend/src/app/siddes-inbox/page.tsx`
- ✅ Thread view — `frontend/src/app/siddes-inbox/[id]/page.tsx`
- ✅ Context guard patterns — present in thread/inbox code
- 🟡 Backend: still stubbed for some flows (expected)

## F) Profile + Connections

- ✅ Profile page — `frontend/src/app/siddes-profile/page.tsx`
- 🟡 Terminology — Profile still renders Side/Siding (needs Side/Sided)
- 🟡 Siders/Siding privacy model — concept agreed; owner-only not fully enforced in UI yet
- ❌ Side Personas — not implemented (major differentiator)

## G) Sets

- ✅ Sets page — `frontend/src/app/siddes-sets/page.tsx` (Suspense fix present)
- ✅ Guided create flow — `frontend/src/components/CreateSetSheet.tsx`
- 🟡 Membership management — partially stubbed
- 🟡 Set-scoped invites — partially stubbed

## H) Invites

- ✅ Invites dashboard — `frontend/src/app/siddes-invites/page.tsx`
- ✅ Invite acceptance — `frontend/src/app/invite/[id]/page.tsx`
- 🟡 Post-accept onboarding moment — not yet integrated

## I) Public Topics (Politics, Sports, etc)

- ✅ Public topics data — `frontend/src/lib/publicChannels.ts`
- ✅ Trust dial scaffolding — `frontend/src/lib/publicTrustDial.ts`
- 🟡 “Topics” UI — not renamed everywhere (still “Topics”)
- ❌ Full “Today in Public” topic picker sheet — not implemented (module exists as stub)

## J) Remixed Feed Modules (“Stealables”)

- ✅ Framework (flagged) — `feedModules.ts`, `FeedModuleCard.tsx`, injected in SideFeed
- ✅ Dismiss + undo — present
- 🟡 Modules are stub payloads (fine for v0)

## K) Work extras

- 🟡 Work triage module exists (feed module)
- ❌ Work task composer + task cards + board toggle — not integrated yet

## L) Media types

- 🟡 Image/video/link/gallery behaviors — mocked in design, not fully implemented in PostCard

## M) PWA / Offline

- 🟡 PWA plan docs exist — `docs/PWA_PLAN.md`
- 🟡 Offline indicator exists — UI components present
- ❌ Outbox screen (manage queued posts) — not built yet

## N) Search / Discover

- ❌ Dedicated search/discover pages — not built (only local search widgets exist)

---

## Next recommended build order

1) Rename Profile “Side” → “Side/Sided” + Unside confirmation  
2) Rename Public “Topics” → “Topics” everywhere UI-facing  
3) Implement Side Personas v0 (local-first)  
4) Work extras v0 (composer + tasks + board toggle)  
5) Media policy implementation (autoplay, share gating, gallery)
