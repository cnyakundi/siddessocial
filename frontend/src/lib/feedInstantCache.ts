"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedItem, FeedPage } from "@/src/lib/feedProvider";

type CacheEntry = {
  ts: number;
  page: FeedPage;
};

type CacheState = Record<string, CacheEntry>;

// Keep this short: "instant feel" for side switching + repeat loads,
// not a long-lived offline archive.
const TTL_MS = 90_000;
const KEY = "__sd_feed_instant_cache_v1__";
const MAX_KEYS = 12;
const MAX_ITEMS = 80;

function now() {
  return Date.now();
}

function hasWindow() {
  return typeof window !== "undefined";
}

function loadState(): CacheState {
  if (!hasWindow()) return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CacheState;
  } catch {
    return {};
  }
}

function saveState(state: CacheState) {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function makeFeedCacheKey(args: {
  epoch: string;
  viewerId: string;
  side: SideId;
  topic?: string | null;
  setId?: string | null;
  cursor?: string | null;
  limit?: number;
}) {
  const topic = String(args.topic || "").trim() || "_";
  const setId = String(args.setId || "").trim() || "_";
  const cursor = String(args.cursor || "").trim() || "first";
  const limit = typeof args.limit === "number" ? String(args.limit) : "_";

  // NOTE: Epoch is critical. It rotates when auth state changes.
  return `feed:v1|epoch:${args.epoch}|viewer:${args.viewerId}|side:${args.side}|topic:${topic}|set:${setId}|cursor:${cursor}|limit:${limit}`;
}

export function getCachedFeedPage(key: string): FeedPage | null {
  if (!key) return null;
  const state = loadState();
  const entry = state[key];
  if (!entry) return null;
  if (now() - entry.ts > TTL_MS) return null;
  return entry.page;
}

export function setCachedFeedPage(key: string, page: FeedPage) {
  if (!key) return;
  if (!page || !Array.isArray(page.items)) return;

  // Defensive clamp: never store huge payloads.
  const safePage: FeedPage = {
    items: (page.items as FeedItem[]).slice(0, MAX_ITEMS),
    nextCursor: page.nextCursor ?? null,
    hasMore: Boolean(page.hasMore),
  };

  const state = loadState();
  state[key] = { ts: now(), page: safePage };

  // Prune: keep only the most recent MAX_KEYS.
  const keys = Object.keys(state);
  if (keys.length > MAX_KEYS) {
    keys
      .sort((a, b) => (state[b]?.ts || 0) - (state[a]?.ts || 0))
      .slice(MAX_KEYS)
      .forEach((k) => {
        delete state[k];
      });
  }

  saveState(state);
}

export function clearFeedInstantCache() {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
