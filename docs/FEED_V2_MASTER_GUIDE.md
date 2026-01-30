# Feed V2 Master Guide (Threads‑style media + threaded replies)

This document is the **single source of truth** for implementing **Feed V2** in Siddes:
- Threads-style media (carousel + fullscreen viewer)
- Threaded replies (nested + collapsible)
- Always-visible engagement (no hover dependency)
- Room-safe sharing
- Optional “Seen by” receipts (Friends/Close only)

> **Goal:** ship a feed that feels as clean as Threads (web + mobile) while staying **Siddes‑correct**: **Side** (context) + **Set** (sub-audience) are enforced server-side (no UI-only privacy).

---

## 0) Terminology and naming

Siddes canonical vocabulary (see `docs/UI_HEARTBEAT.md`):
- **Side** = context mode (public/friends/close/work)
- **Set** = subgroup inside a Side (audience subset)
- **Topic** = Public-only filing label (internal detail)

Design conversations may use **Room/Circle**. For implementation:
- Keep **Side/Set** as the canonical names in code + data contracts.
- UI copy changes (e.g., showing “Room” instead of “Side”, “Circle” instead of “Set”) can be done later as a **copy-only pass**.

---

## 1) Repo references (read these first)

Structural maps:
- `docs/SPIDER_AUDIT/PHASE2_POSTS_PIPELINE_SPIDERPACK.md` — post pipeline, post detail, replies.
- `docs/SPIDER_AUDIT/PHASE2_MEDIA_SPIDERPACK.md` — R2 + `/m/*` serving + frontend render expectations.
- `docs/SPIDER_AUDIT/PHASE2_CHAMELEON_SPIDERPACK.md` — side switching surfaces + invariants.

Media parity rules:
- `docs/MEDIA_THREADS_STYLE.md` — **first attachment defines aspect ratio**, clamp bounds, viewer chrome.

(Keep these as “truth” while coding.)

---

## 2) UX contract (what we are building)

### 2.1 Feed surface (`/siddes-feed`)
Required UI blocks:
1) **Header**
   - title (“Siddes”)
   - compose entry (launcher)
2) **Side switcher (segmented control)**
   - public / friends / close / work
   - supports a **quiet “new” dot** (e.g., Close)
3) **Set chips row (non-public only)**
   - `All` + `Set` chips + `New`
   - switching chips filters the feed
4) **Post list**
   - PostCard V2 (below)

### 2.2 PostCard V2 (single canonical component)
Required layout:
- Header: avatar, name, handle/time, **Side + Set** chips, overflow menu
- Body: text + optional link preview
- Media: carousel/video/quote blocks
- **Counts row** (always visible): `142 likes • 12 replies • 3 echoes`
- **Actions row** (no counts): Like / Reply / Echo / Share

Required interactions:
- Tap PostCard opens thread (post detail)
- Like toggles immediately
- Reply opens thread
- Echo toggles + toast; long-press opens Quote composer
- Share opens Share sheet (room-safe)
- Overflow opens Post menu sheet (hide/mute/report)

Optional “sweetness”:
- Friends/Close only: `Seen by 7` → opens Seen-by sheet

### 2.3 Thread surface (`/siddes-post/[id]`)
Required:
- Root post at top (same PostCard rendering rules for media)
- Thread tree:
  - nested replies with indent lines
  - collapsed branches: “Show more replies”
  - “Replying to @X” label when replying to a reply
- Bottom reply composer (sticky)
- Side chip visible near composer (“You are replying in Friends”)

---

## 3) Media V2 (Threads‑style cleanliness)

### 3.1 The “hidden rule” (must follow)
For multi-attachment posts, **the first attachment defines the aspect ratio** for the whole set.

Compute:
- `r = width / height` from first media item’s metadata
- clamp:
  - min `0.8` (4:5)
  - max `1.91` (1.91:1)
- Render all tiles with:
  - `aspect-ratio: r`
  - `object-fit: cover` (in feed tiles)

This creates the tight uniform “Threads web” row look.

### 3.2 In-feed carousel (mobile + desktop)
Requirements:
- Horizontal swipe with snap points
- Dots + `1/6` counter (overlay)
- Desktop hover arrows
- “Edge peek” hint (subtle) so users discover swipe
- Double-tap like on mobile (gesture spec; implement with tap timing, not `dblclick`)

### 3.3 Video (inline)
Requirements:
- Tap toggles play/pause
- Mute toggle
- Scrub bar appears on interaction/hover
- Expand button opens fullscreen viewer
- `playsInline` on mobile

### 3.4 Fullscreen viewer
Requirements:
- Black backdrop, minimal chrome
- Swipe left/right (mobile)
- Swipe down to dismiss (mobile)
- Desktop arrows + keyboard left/right
- (Phase 2) pinch-to-zoom + double-tap zoom (images)

**Non-negotiable:** closing viewer returns to:
- exact feed scroll position
- exact post
- exact carousel index

---

## 4) Room-safe sharing (Share Sheet)

### Public
- Send to Inbox
- Copy link
- Share externally

### Friends/Close/Work
- Send to Inbox (default)
- Copy link (allowed but link requires auth)
- External share disabled (or hidden)

---

## 5) “Seen by” receipts (optional; ship after core)

Policy:
- Only for **Friends** and **Close**
- Visible only to the **post author** (and optionally the poster’s Set members)
- Never shown in Public
- Work is off by default

UI:
- PostCard shows `Seen by 7` with 2–3 tiny avatar previews
- Tap opens a list sheet

Backend (when you implement):
- Create `PostView` rows `(post_id, viewer_id, created_at, side, set_id)`
- Record views on: open thread OR when a post becomes visible for N ms
- Expose:
  - count + preview
  - list endpoint gated to author

---

## 6) Data contracts (frontend expectations)

### 6.1 Feed post shape (minimum)
```
post = {
  id: string,
  side: "public"|"friends"|"close"|"work",
  setId?: string|null,
  author: { id, handle, name, avatarUrl? },
  text: string,
  ts: number,
  stats: { likes, replies, echoes, shares },
  viewer: { liked?: boolean, echoed?: boolean },
  media?: [
    { id, kind:"image"|"video", url, width?, height?, durationMs?, contentType? }
  ],
  quote?: { ... } // optional
}
```

### 6.2 Reply shape (minimum for threading)
```
reply = {
  id: string,
  postId: string,
  parentId?: string|null,
  author: { id, handle, name, avatarUrl? },
  text: string,
  ts: number,
  likes: number,
  viewer: { liked?: boolean }
}
```

---

## 7) Implementation plan (“windows”)

Each window is designed to be small, verifiable, and mergeable.

### Window 1 — Feed header + Set chips wiring
Goal:
- Header + Side switcher + Set chips row (non-public only)
- Chips actually filter feed

Touchpoints (expected):
- `frontend/src/components/SideFeed.tsx`
- `frontend/src/components/SetFilterBar.tsx` (or equivalent)

Acceptance:
- Public hides chips
- Selecting a Set filters posts
- `All` resets filter

### Window 2 — PostCard V2 layout (counts + actions + preview)
Goal:
- Counts row always visible
- Actions row icon-only
- Reply preview row + “View thread”

Touchpoints:
- `frontend/src/components/PostCard.tsx`

Acceptance:
- No hover-only engagement signals
- Like/reply/echo/share entrypoints exist

### Window 3 — Media V2 (carousel + viewer)
Goal:
- In-feed carousel + fullscreen viewer + video controls
- Matches `docs/MEDIA_THREADS_STYLE.md`

Touchpoints:
- `frontend/src/components/PostCard.tsx` (replace MediaGrid behavior)
- New components recommended:
  - `frontend/src/components/media/MediaCarousel.tsx`
  - `frontend/src/components/media/MediaViewer.tsx`
  - `frontend/src/components/media/InlineVideo.tsx`

Acceptance:
- Carousel swipe (mobile)
- Hover arrows (desktop)
- Viewer swipe down to dismiss (mobile)
- Close returns to same scroll + index

### Window 4 — Thread V2 UI (collapsed branches + reply-to)
Goal:
- Post detail uses a real thread tree UI
- Collapsed branch placeholders expand
- Reply composer anchored

Touchpoints:
- `frontend/src/app/siddes-post/[id]/page.tsx`
- Any reply list components used there

Backend dependency:
- If your backend replies are flat, ship UI collapse first, then add `parentId` later.

Acceptance:
- Thread opens/closes with perfect back behavior
- Reply-to label visible when replying to replies

### Window 5 — Sheets (share/menu/seen-by/quote)
Goal:
- Share sheet enforces room-safe policy
- Post menu sheet: hide/mute/report
- Seen-by sheet (Friends/Close only)
- Quote composer (Echo long-press)

Touchpoints:
- New components recommended:
  - `frontend/src/components/sheets/ShareSheet.tsx`
  - `frontend/src/components/sheets/PostMenuSheet.tsx`
  - `frontend/src/components/sheets/SeenBySheet.tsx`
  - `frontend/src/components/compose/QuoteComposer.tsx`

Acceptance:
- Public has external share; private rooms do not
- Menu actions are reachable
- Quote composer shows quoted preview

### Window 6 — Backend upgrades (only when needed)
1) Threading:
   - Add `parent_reply_id` nullable on replies
   - Update reply create/read endpoints
2) Reply likes:
   - Add `ReplyLike` model and endpoints
3) Seen-by:
   - Add `PostView` tracking + author-gated endpoints

---

## 8) QA gates (Definition of Done per window)

Run for every window:
- `./verify_overlays.sh`
- `bash scripts/run_tests.sh --smoke`
- `cd frontend && npm run typecheck && npm run build`

Manual smoke:
- Switch sides in feed
- Filter by set
- Open media viewer and close (scroll position preserved)
- Open thread and back (scroll position preserved)
- Share policy differs between Public and Friends/Close/Work

---

## 9) Feature flags and rollout (recommended)
Introduce:
- `NEXT_PUBLIC_SD_FEED_V2=1`

Rollout pattern:
1) Enable in Public only (media + viewer)
2) Enable in Friends/Close
3) Enable in Work after privacy checks

---

## 10) Performance & privacy notes (don’t skip)
- Ensure Service Worker does **not** cache private `/m/*` responses.
- Do not leak Side/Set in cache keys.
- Use `loading="lazy"` + `decoding="async"` on images.
- Video: `preload="metadata"` + `playsInline`.

---

## Appendix A — “Giant Mock” checklist (what the designer mocked)
Minimum scenes:
- Feed with carousel + viewer + swipe
- Video controls + expand
- Thread tree + “show more replies”
- Share sheet (public vs private)
- Post menu sheet
- Seen-by sheet
- Quote composer

This guide is complete when those are implementable without ambiguity.

