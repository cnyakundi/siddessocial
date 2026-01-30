# Siddes — Phases & Subphases (official roadmap)

This file is the **structure**. Each overlay zip implements one small chunk and updates `docs/STATE.md`.

## Phase 0 — Baseline (docs + workflow)
- 0.1 Overlay tooling bootstrap (apply/verify scripts)
- 0.2 Documentation “project bible”
- 0.3 Docker dev bootstrap (optional)
- 0.4 Testing harness + quality gates

## Phase 1 — PWA foundation + Side OS skeleton
- 1.1 PWA app shell (manifest, icons, SW baseline)
- 1.2 Global Side state + SideBadge everywhere
- 1.3 Side switcher sheet + activity pills

## Phase 2 — Feed + PostCard + context chips
- 2.1 Side feeds (Public/Friends/Close/Work)
- 2.2 PostCard spine + structure
- 2.3 Context chips (Circle/Mention/Doc/Urgent) + overflow +N sheet

## Phase 3 — Signals + Echo loop
- 3.1 Signals counter + Signals sheet (tabs)
- 3.2 Echo sheet (Echo / Quote / Share externally)
- 3.3 Quote Echo composer attach (source preview)

## Phase 4 — Circles + contact DNA
- 4.1 Friends sets chips + counts + filter
- 4.2 Guided set creation flow
- 4.3 Contact matching endpoint (HMAC tokens)
- 4.4 Suggested sets after sync (Accept/Rename/Skip) [later]

## Phase 5 — Profiles + access gating
- 5.1 Profile view is Side-aware
- 5.2 Access gates (no leakage)
- 5.3 Pinned item + relationship context

## Phase 6 — Return loop (notifications + peek)
- 6.1 Notifications with glimpses + filters
- 6.2 Peek sheet (long-press Side badge) using real data
- 6.3 “Since last visit” divider tied to LastSeen

## Phase 7 — PWA power upgrades
- 7.1 Workbox caching strategies
- 7.2 Push notifications with glimpses
- 7.3 Offline post queue (optional)

## Phase 8 — Compose Intelligence Engine
- 8.1 Suggestion bar (Side/Circle/Urgent) as you type
- 8.2 Rules + confidence thresholds
- 8.3 Embeddings + optional LLM fallback (later)
