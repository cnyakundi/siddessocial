# Siddes — Consolidated Window Status Report (Up-to-date Zip Audit)

**Zip audited:** `sidesroot_source_of_truth_clean_20260125_115706.zip`  
**Audit date:** 2026-01-25  
**Goal of this document:** single source of truth for **what we focused on**, **what’s already done in the current code**, and **what remains / is misconfigured** so we stop “window drift”.

---

## 0) Executive Summary

### What we were doing (Window C — Performance & Reliability)
We were executing the **Performance & Reliability Engine** plan:
- Make the app feel instant (feed + inbox + search) and eliminate “random hangs”
- Remove N+1 query bombs (feed visibility checks, inbox unread counts)
- Make media stable (Worker `/m/*` path + correct SW caching)
- Reduce UI jank (PostCard heavy components + video previews)
- Add measurement hooks so we can prove p95 improvements and prevent regressions

### What’s already done in *this* zip (✅ present)
- **Proxy hard timeouts exist** for most `/api/*` routes via `frontend/src/app/api/auth/_proxy.ts` (includes `sd_609_proxy_timeout` marker).
- **Service Worker media caching safety exists** (`sd_610_sw_media_cache_safety`) in `frontend/public/sw.js`:
  - SW does **not** cache `/api/*`
  - `/m/*` cached only when explicitly public-cacheable
  - Range/video requests not cached
- **Inbox views include bulk block filtering hardening** (backend inbox view logic present).
- **Feed caching + virtualization exists** (see `docs/PERFORMANCE_SUPERSONIC.md` + `frontend/src/components/SideFeed.tsx` using window virtualizer and feed cache headers in backend).

### What is still misconfigured (🚨 must fix before continuing)
These are the items causing cross-window flake and perf regressions:

1) **FEED set-filter mismatch:** `backend/siddes_feed/views.py` reads `set=` and includes it in the **cache key** but does **not pass set_id into `list_feed()`**, meaning:
   - wrong data can be cached under a set-specific key
   - wasted scanning hurts p95  
   **Evidence:** `backend/siddes_feed/views.py` line ~177 calls  
   `list_feed(viewer_id=viewer, side=side, topic=topic, limit=limit, cursor=cursor_raw)` (missing `set_id=set_id`)

2) **FEED redundant set membership check still runs:** `backend/siddes_feed/feed_stub.py` checks `_set_allows()` *after* `_can_view_record()` already did it.  
   **Evidence:** `backend/siddes_feed/feed_stub.py` line ~632  
   `if sid and not _set_allows(viewer_id, sid): continue`

3) **FEED Next proxy `/api/feed` has no Abort timeout and doesn’t passthrough cache timing headers consistently**, so feed can “hang” despite proxy timeouts elsewhere.  
   **Evidence:** `frontend/src/app/api/feed/route.ts` uses `fetch()` without `AbortController`.

4) **MEDIA Next BFF routes are missing** even though the client calls them:
   - `/api/media/sign-upload`
   - `/api/media/commit`
   - `/api/media/url`
   - `/api/media/refresh`  
   **Evidence:** `frontend/src/lib/mediaClient.ts` uses these paths; `frontend/src/app/api/media/` does not exist.

5) **INBOX unread counts are still N+1 in DB store.**  
   **Evidence:** `backend/siddes_inbox/store_db.py` `_derive_unread_map_for_threads()` line ~121:  
   `InboxMessage.objects.filter(thread_id=tid, ts__gt=cutoff).count()` inside a loop per thread.

6) **PostCard perf packs are not present in this zip** (no lazy-mounting of sheets/modals, no “prefetch once”, no video preview de-weighting).  
   **Evidence:** `frontend/src/components/PostCard.tsx` lacks conditional mounts and still mounts heavy overlays per row.

---

## 1) Window C — Performance & Reliability Engine (Status)

### 1.1 Budget (targets we are working toward)
- **TTFB (route shell):** p95 ≤ 400ms (prod)
- **LCP:** Feed ≤ 1.5s (mid device), other key screens ≤ 2.0s
- **CLS:** ≤ 0.05 target (hard cap 0.10)
- **INP:** ≤ 200ms target (hard cap 350ms)
- **API p95:** Feed ≤ 250ms, Inbox threads ≤ 200ms, Thread view ≤ 250ms, Search posts ≤ 350ms

(Reference: `docs/PERFORMANCE_SUPERSONIC.md`)

### 1.2 What we already have (✅)
**Feed**
- Redis hot cache exists at the Django layer (`backend/siddes_feed/views.py` sets `X-Siddes-Cache` / TTL)
- Cursor contract exists (`docs/PERFORMANCE_SUPERSONIC.md`)
- Frontend feed is window-virtualized (`frontend/src/components/SideFeed.tsx` uses `useWindowVirtualizer`)

**Proxy reliability**
- `frontend/src/app/api/auth/_proxy.ts` has a hard timeout and request id support.

**Media**
- Worker token URL minting exists on backend, plus refresh endpoint (`backend/siddes_media/views.py: MediaRefreshUrlView`)
- SW caching safety for `/m/*` exists (`frontend/public/sw.js`)

### 1.3 What we were actively implementing (work plan)
- **Part 1:** Feed p95 hardening (bulk visibility checks + correct set filtering + reliable timeouts)
- **Part 2:** PostCard jank removal (lazy-mount modals/sheets, remove video previews from list)
- **Part 3:** Media reliability (BFF routes + SW rules + refresh flow)
- **Part 4:** Search performance (debounce/cancel, stop set overfetch, cheap DTO)
- **Part 5:** Inbox (remove unread N+1 + abort/race protection)

### 1.4 What remains (❗), in priority order
**P0 — stop correctness bugs + remove biggest p95 spikes**
1) FeedView must pass `set_id` into `list_feed()`
2) Remove redundant `_set_allows()` check in `list_feed()` scan loop
3) Add AbortController timeout + header passthrough to Next `/api/feed`
4) Add missing Next media BFF routes (`/api/media/*`)
5) Fix Inbox unread N+1 (bulk aggregation or denormalized unread state)

**P1 — make “feels instant” real**
6) Feed UI: in-memory per-{side,topic,set} cache + abort-on-switch
7) PostCard: lazy-mount heavy overlays + “prefetch once” + no list video elements
8) Search: stop fetching all sets per query; add cancel/debounce; unify request

**P2 — measurement + regression prevention**
9) Add DB query count + DB time headers (dev-only) and `Server-Timing` on core endpoints
10) Add perf bench scripts for inbox/search similar to `scripts/dev/perf_feed_bench.sh`

---

## 2) Other Windows Observed in This Zip (high-level)

You’ve got multiple “window tracks” in motion; this zip contains evidence via many recent `.backup_sd_*` packs (Jan 25).

### 2.1 Window A — Account lifecycle / auth / onboarding (✅ largely real)
Evidence in frontend route handlers:
- `frontend/src/app/api/auth/*` includes signup/login/logout/password reset/magic links, account deletion flows.
Routes in App Router:
- `frontend/src/app/onboarding/*`, `login`, `signup`, account deletion flows.

Docs:
- `docs/ACCOUNT_LIFECYCLE_ENGINE.md`, `docs/ACCOUNT_LIFECYCLE.md`

**Risk:** docs like `STATE.md` / `OVERLAYS_INDEX.md` are stale (last updated 2026-01-19), which makes “what’s real” confusing.

### 2.2 Window B — Safety + Trust (✅ in progress, partially wired)
Evidence:
- blocks endpoints exist (`frontend/src/app/api/blocks/*`)
- moderation/admin surfaces exist (`frontend/src/app/siddes-moderation/*`)
Docs:
- `docs/PUBLIC_TRUST_GATES.md`, `docs/AUDIT_RUNBOOK.md`

### 2.3 Window E — QA / release hardening (✅ actively applied)
Evidence:
- multiple backups mentioning overlay contract, E2E CSRF fixes, typecheck fixes
Docs:
- `docs/E2E_SMOKE.md`, `docs/DEPLOYMENT_GATES.md`, `docs/GO_LIVE_MASTER_RUNBOOK.md`

---

## 3) Cross-Window Misconfiguration Register (the real blockers)

### M-001 — Feed cache key includes `set`, but set filter isn’t enforced
- Fix: pass `set_id` into `list_feed()`
- Severity: **High** (correctness + perf)

### M-002 — Missing Next media BFF routes (uploads/refresh)
- Fix: implement `frontend/src/app/api/media/*/route.ts` proxies for Django endpoints
- Severity: **High** (breaks uploads + makes media flaky)

### M-003 — Inbox unread N+1 in DB store
- Fix: bulk aggregate counts or denormalize unread state
- Severity: **High** (p95 blowups)

### M-004 — `/api/feed` proxy missing timeout
- Fix: use AbortController and return deterministic errors
- Severity: **Medium/High** (hangs)

### M-005 — PostCard heavy overlays mounted per row
- Fix: lazy-mount + centralize overlays
- Severity: **Medium** (jank)

### M-006 — Docs are stale relative to applied packs
- Fix: update `docs/STATE.md` + `docs/OVERLAYS_INDEX.md` to match Jan 25 reality
- Severity: **Medium** (coordination + confusion)

---

## 4) The “One Thing” Plan (single consolidated track)

To stop window drift, we do **one consolidation sprint**:

### Phase 1 — Stabilization Fix Pack (must-pass gates)
- Fix M-001, M-002, M-003, M-004
- Add a short audit doc update with:
  - exact file paths touched
  - verification commands
  - recorded in `docs/STATE.md` and `docs/OVERLAYS_INDEX.md`

### Phase 2 — Perceived Speed Pack
- PostCard lazy mount + no list videos
- Feed in-memory SWR cache + abort-on-switch
- Search cancel/debounce + set fetch caching

### Phase 3 — Instrumentation + regression prevention
- DB query count headers (dev)
- Server-Timing
- Bench scripts for feed/inbox/search

---

## 5) Verification Commands (run after each pack)

**Repo integrity**
```bash
./verify_overlays.sh
./scripts/run_tests.sh
```

**Backend**
```bash
bash scripts/checks/backend_python_compileall_check.sh
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py test
```

**Frontend**
```bash
cd frontend && npm run typecheck && npm run build
```

**Perf benches**
```bash
bash scripts/dev/perf_feed_bench.sh
# (add later) perf_inbox_threads_bench.sh
# (add later) perf_search_posts_bench.sh
```

---

## 6) Notes
- `docs/STATE.md` and `docs/OVERLAYS_INDEX.md` show **2026-01-19**, but this zip clearly includes many Jan 25 fix packs. Updating these is key to reducing “which window is real?” confusion.
- Once Phase 1 is complete, Window C work becomes incremental and safe (no more misconfig churn).
