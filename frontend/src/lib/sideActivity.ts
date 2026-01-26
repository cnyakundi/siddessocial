"use client";

import type { SideId } from "@/src/lib/sides";
import { getLastSeenId } from "@/src/lib/lastSeen";

// sd_181k: DB-backed Side activity (no mock posts).
// We fetch DB-backed feed items via /api/feed?side=<side> and compute:
// - unread count since lastSeenId(side)
// - work microchips: mentions/docs (best-effort based on feed item fields)
//
// sd_431: UI Cleanroom perf hardening
// Previously, multiple chrome components were polling side activity in parallel
// (4s/5s/2s/1.5s intervals), which created unnecessary background fetch churn.
// This module now supports:
// - a single shared poller (startSideActivityEngine)
// - a subscription API for UI (subscribeSideActivity)
// - active-side biased refresh cadence (active side more frequent; other sides slower)

export type SideActivity = {
  unread: number;
  mentions?: number;
  docs?: number;
};

export type SideActivityMap = Record<SideId, SideActivity>;

type FeedItem = { id: string; kind?: string; context?: string; hasDoc?: boolean; [k: string]: any };

const SIDES: SideId[] = ["public", "friends", "close", "work"];

const POSTS_BY_SIDE: Record<SideId, FeedItem[]> = {
  public: [],
  friends: [],
  close: [],
  work: [],
};

let CACHE: SideActivityMap = {
  public: { unread: 0 },
  friends: { unread: 0 },
  close: { unread: 0 },
  work: { unread: 0, mentions: 0, docs: 0 },
};

// Active-side bias
let ACTIVE_SIDE: SideId = "friends";

// Per-side fetch timing
const LAST_FETCH: Record<SideId, number> = {
  public: 0,
  friends: 0,
  close: 0,
  work: 0,
};

const MIN_ACTIVE_MS = 20_000; // fetch the active side at most ~every 12s
const MIN_OTHER_MS = 180_000; // fetch non-active sides at most ~every 60s

// Concurrency guard
let inFlight: Promise<void> | null = null;

// Subscriptions
type Listener = (map: SideActivityMap) => void;
const LISTENERS = new Set<Listener>();

function notify(): void {
  for (const fn of LISTENERS) {
    try {
      fn(CACHE);
    } catch {
      // ignore
    }
  }
}

export function subscribeSideActivity(fn: Listener): () => void {
  LISTENERS.add(fn);
  // immediate push
  try {
    fn(CACHE);
  } catch {
    // ignore
  }
  return () => {
    LISTENERS.delete(fn);
  };
}

export function setSideActivityActiveSide(side: SideId): void {
  // Guard against weird values
  if (side === "public" || side === "friends" || side === "close" || side === "work") {
    ACTIVE_SIDE = side;
  }
}

function safeItems(j: any): FeedItem[] {
  const items = Array.isArray(j?.items) ? j.items : [];
  return items.filter((p: any) => p && typeof p.id === "string").slice(0, 80);
}

function computeUnread(side: SideId, posts: FeedItem[]): number {
  if (!posts.length) return 0;
  const lastSeen = getLastSeenId(side);
  if (!lastSeen) return posts.length;
  const idx = posts.findIndex((p) => p.id === lastSeen);
  if (idx === -1) return posts.length;
  return idx; // posts before idx are newer
}

function computeWorkBreakdownFromPosts(posts: FeedItem[]): { mentions: number; docs: number } {
  if (!posts.length) return { mentions: 0, docs: 0 };
  const lastSeen = getLastSeenId("work");
  const idx = lastSeen ? posts.findIndex((p) => p.id === lastSeen) : -1;
  const slice = idx === -1 ? posts : posts.slice(0, idx);

  let mentions = 0;
  let docs = 0;
  for (const p of slice) {
    if (p?.context === "mention") mentions += 1;
    if (p?.hasDoc || p?.kind === "link") docs += 1;
  }
  return { mentions, docs };
}

function recompute(): void {
  const wb = computeWorkBreakdownFromPosts(POSTS_BY_SIDE.work);

  CACHE = {
    public: { unread: computeUnread("public", POSTS_BY_SIDE.public) },
    friends: { unread: computeUnread("friends", POSTS_BY_SIDE.friends) },
    close: { unread: computeUnread("close", POSTS_BY_SIDE.close) },
    work: { unread: computeUnread("work", POSTS_BY_SIDE.work), mentions: wb.mentions, docs: wb.docs },
  };
}

export function getSideActivityMap(): SideActivityMap {
  return CACHE;
}

async function fetchOneSide(side: SideId): Promise<boolean> {
  try {
    const res = await fetch(`/api/feed?side=${encodeURIComponent(side)}&limit=40&lite=1`, { cache: "no-store" });
    const j = await res.json().catch(() => null);

    if (j && j.restricted) {
      POSTS_BY_SIDE[side] = [];
      return true;
    }

    if (j && Array.isArray(j.items)) {
      POSTS_BY_SIDE[side] = safeItems(j);
      return true;
    }
  } catch {
    // Keep old cache on errors
  }
  return false;
}

export async function refreshSideActivityMap(opts?: { force?: boolean; sides?: SideId[] }): Promise<void> {
  const now = Date.now();
  const wanted = (opts?.sides && opts.sides.length) ? opts.sides : SIDES;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let didFetch = false;

    await Promise.all(
      wanted.map(async (side) => {
        const minMs = side === ACTIVE_SIDE ? MIN_ACTIVE_MS : MIN_OTHER_MS;

        if (!opts?.force) {
          const last = LAST_FETCH[side] || 0;
          if (now - last < minMs) return;
        }

        LAST_FETCH[side] = now;
        const ok = await fetchOneSide(side);
        if (ok) didFetch = true;
      })
    );

    if (!didFetch && !opts?.force) return;

    recompute();
    notify();
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

function isVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

let ENGINE_STARTED = false;
let ENGINE_TICKS = 0;
let ENGINE_TIMER: number | null = null;

export function startSideActivityEngine(): void {
  if (ENGINE_STARTED) return;
  if (typeof window === "undefined") return;

  ENGINE_STARTED = true;

  const tick = () => {
    if (!isVisible()) return;

    ENGINE_TICKS += 1;

    // Every ~5 ticks, do a full sweep so other-side dots stay reasonably fresh.
    const doFull = ENGINE_TICKS === 1 || ENGINE_TICKS % 5 === 0;
    const sides = doFull ? SIDES : [ACTIVE_SIDE];

    refreshSideActivityMap({ sides }).catch(() => {});
  };

  // First tick immediately
  tick();

  ENGINE_TIMER = window.setInterval(tick, MIN_ACTIVE_MS);

  const onWake = () => {
    // On focus/visibility restore, force a quick refresh of the active side
    refreshSideActivityMap({ force: true, sides: [ACTIVE_SIDE] }).catch(() => {});
  };

  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", () => {
    if (isVisible()) onWake();
  });

  // Note: no explicit stop() — this is a singleton engine scoped to the app lifetime.
  void ENGINE_TIMER;
}

export function formatActivityPill(n: number): string {
  if (n >= 20) return "20+";
  return String(n);
}
