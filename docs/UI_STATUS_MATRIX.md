# Siddes UI Status Matrix

**Updated:** 2026-01-23  
Snapshot of what is implemented in the repo vs what is stubbed/missing. This is the **design + engineering source of truth** for UI readiness.

Legend:
- ✅ Done (implemented + usable)
- 🟡 Partial (present but stubbed / missing wiring / needs polish)
- ❌ Not done (hidden or not built)

---

## A) Global Shell

- ✅ Desktop protocol grid (80px topbar) — `frontend/src/components/AppShell.tsx`
- ✅ Protocol math locked (no 56px leftovers) — `frontend/src/app/globals.css` (`.sd-min-h-shell`)
- ✅ Side Provider (Public confirm + lock support) — `frontend/src/components/SideProvider.tsx`
- ✅ Mobile airlock overlay — `frontend/src/components/MobileAirlockOverlay.tsx`
- ✅ Desktop airlock overlay (cinematic for Public boundary, tint otherwise) — `frontend/src/components/DesktopAirlockOverlay.tsx`
- ✅ Desktop Side dock (lock badges when route-locked) — `frontend/src/components/DesktopSideDock.tsx`
- ✅ Desktop Context Inspector rail (collapsed/expanded) — `frontend/src/components/DesktopContextInspectorRail.tsx`

## B) Feed

- ✅ Side feed route — `frontend/src/app/siddes-feed/page.tsx`
- ✅ Feed engine (cursor paging, virtualization, module injection) — `frontend/src/components/SideFeed.tsx`
- ✅ Feed provider uses same-origin Next proxy — `frontend/src/lib/feedProviders/backendStub.ts`
- ✅ Set filter is **server-truth** end-to-end — Next `/api/feed` forwards `set=`, backend filters by `set_id`
  - `frontend/src/app/api/feed/route.ts`
  - `backend/siddes_feed/views.py`, `backend/siddes_feed/feed_stub.py`
- ✅ Set Picker safety copy + members preview — `frontend/src/components/SetPickerSheet.tsx`
- 🟡 Public Topics/Channels UI copy (“Topic”) — exists; rename/polish later

## C) Compose

- ✅ Compose route + audience inheritance (side + set/topic) — `frontend/src/app/siddes-compose/page.tsx`
- ✅ Media pipeline proxies exist (sign/commit/url) — `frontend/src/app/api/media/*`
- 🟡 Final polish: media attach UX, errors, progress UI (some flows are still minimal)

## D) Post Detail / Thread

- ✅ Thread route — `frontend/src/app/siddes-post/[id]/page.tsx`
- ✅ Sticky reply composer (no modal) + queued replies UI — same file
- ✅ Thread is locked to Side while open (no leakage vibes) — `SideProvider.sideLock`
- 🟡 Deeper nested connector polish (depth>1 visuals) — acceptable for v0, can refine later

## E) Inbox

- ✅ Inbox list (Messages + Alerts tabs) — `frontend/src/app/siddes-inbox/page.tsx`
- ✅ Inbox thread view — `frontend/src/app/siddes-inbox/[id]/page.tsx`
- ✅ Side lock patterns in thread view (dock disables side switching) — via `SideProvider.sideLock`
- 🟡 Some actions are intentionally conservative (disable/hide until fully wired)

## F) Notifications

- ✅ Notifications route — `frontend/src/app/siddes-notifications/page.tsx`
- ✅ **Side-scoped notifications** (Boss-leak prevention) — `backend/siddes_notifications/*` (migration `0003_notification_side.py`)
- ✅ UI “Mark all read” is truthful (disabled on no-op) — `frontend/src/app/siddes-notifications/page.tsx`

## G) Profile / Prism (Personas)

- ✅ Prism hub — `frontend/src/app/siddes-profile/prism/page.tsx`
- ✅ Prism editor (Identity + Audit) — `frontend/src/components/PrismProfile.tsx`
- ✅ Side-aware “Me” avatar (facet-aware) — Bottom nav + Prism
- ✅ Avatar upload per Side (R2) — Prism editor + backend media gate:
  - `frontend/src/components/PrismProfile.tsx`
  - `backend/siddes_prism/*`, `backend/siddes_media/views.py` (`_viewer_can_view_prism_avatar`)
- ✅ External profile view by viewer’s relationship — `frontend/src/app/u/[username]/page.tsx`
- 🟡 “Who sees this version of you?” UI needs deterministic rule text (v0 ok, later tighten)

## H) Sets

- ✅ Sets index — `frontend/src/app/siddes-sets/page.tsx`
- ✅ Set detail hub (tabs) — `frontend/src/app/siddes-sets/[id]/page.tsx`
- ✅ Set detail locks Side switching — via `SideProvider.sideLock`
- 🟡 Membership/invites management: some flows still partial depending on backend state

## I) Invites

- ✅ Invites dashboard — `frontend/src/app/siddes-invites/page.tsx`
- ✅ Invite accept — `frontend/src/app/invite/[id]/page.tsx`
- 🟡 Post-accept onboarding moment (handoff into set feed) — polish later

## J) Universal Search

- ✅ Universal Search page (People + Sets + Takes) — `frontend/src/app/search/client.tsx`
- ✅ Next proxy routes for search exist — `frontend/src/app/api/search/*`
- 🟡 Ranking/presentation polish later (v0 is usable)

## K) Outbox / Offline

- ✅ Outbox screen exists — `frontend/src/app/siddes-outbox/page.tsx`
- ✅ Offline queue engine exists — `frontend/src/lib/offlineQueue.ts`
- 🟡 “Retry all” / backoff strategy polish later

## L) Broadcasts

- ✅ Broadcasts routes exist (directory + hub + compose shell) — `frontend/src/app/siddes-broadcasts/*`
- 🟡 Editorial moderation + verified-source policy (product layer) — not final

---

## Next recommended build order (alignment → launch)

1) **Truth Pass**: remove/disable dead affordances across Tier-0 pages (Feed/Thread/Inbox/Prism/Outbox).  
2) **Deterministic copy pass**: remove remaining drift (“Topic” naming, any copy that implies fake compute).  
3) **E2E smoke tests** for Tier-0 flows (Playwright): switch → post → thread reply → outbox → prism upload → search → notifications.  
4) **Digital Commute** (Boss-leak control): side-scoped system channels + time-locking Work.  
5) **Performance hardening**: route-level code splitting + cache keys + error boundaries.
