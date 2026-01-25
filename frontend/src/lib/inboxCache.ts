"use client";

import type { InboxThreadView } from "@/src/lib/inboxProvider";

type CacheEntry<T> = {
  ts: number;
  value: T;
};

// Keep this short: "instant feel" for thread revisit + back/forward,
// not a long-lived offline archive.
const TTL_MS = 30_000;

// v2: keys are per-user AND per-auth-epoch; v1 was under-scoped in some call sites.
const KEY_V2 = "__sd_inbox_cache_v2__";
const KEY_V1 = "__sd_inbox_cache_v1__";

const MAX_KEYS = 24;

type CacheState = Record<string, CacheEntry<any>>;

function now() {
  return Date.now();
}

function hasWindow() {
  return typeof window !== "undefined";
}

function loadState(): CacheState {
  if (!hasWindow()) return {};
  try {
    const raw = window.sessionStorage.getItem(KEY_V2);
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
    window.sessionStorage.setItem(KEY_V2, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function pruneState(state: CacheState) {
  const t = now();

  // Drop expired / malformed.
  for (const k of Object.keys(state)) {
    const e = (state as any)[k];
    const ts = typeof e?.ts === "number" ? e.ts : 0;
    if (!ts || t - ts > TTL_MS) {
      delete (state as any)[k];
    }
  }

  // Keep only the most recent MAX_KEYS.
  const keys = Object.keys(state);
  if (keys.length > MAX_KEYS) {
    keys
      .sort((a, b) => ((state as any)[b]?.ts || 0) - ((state as any)[a]?.ts || 0))
      .slice(MAX_KEYS)
      .forEach((k) => {
        delete (state as any)[k];
      });
  }
}

export function makeThreadCacheKey(args: {
  id: string;
  viewerId?: string | null;
  epoch?: string | null;
  limit?: number;
  cursor?: string | null;
}) {
  const viewer = String(args.viewerId || "").trim();
  const epoch = String(args.epoch || "").trim();

  // Fail closed: never build a cache key without identity scoping.
  if (!viewer || !epoch) return "";

  const limit = args.limit ?? 0;
  const cursor = String(args.cursor || "").trim() || "first";

  // Epoch is critical. It rotates when auth/user changes.
  return `thread:v2|epoch:${epoch}|viewer:${viewer}|id:${args.id}|limit:${limit}|cursor:${cursor}`;
}

export function getCachedThread(key: string): InboxThreadView | null {
  if (!key) return null;

  const state = loadState();
  pruneState(state);

  const entry = state[key];
  if (!entry) return null;
  if (now() - entry.ts > TTL_MS) {
    delete state[key];
    saveState(state);
    return null;
  }
  return entry.value as InboxThreadView;
}

export function setCachedThread(key: string, value: InboxThreadView) {
  if (!key) return;

  // Safety: don't cache restricted/empty threads.
  if (!value || !value.thread) return;

  const state = loadState();
  pruneState(state);

  state[key] = { ts: now(), value };
  pruneState(state);
  saveState(state);
}

export function deleteCachedThread(key: string) {
  if (!key) return;

  const state = loadState();
  if (!state[key]) return;
  delete state[key];
  saveState(state);
}

export function clearInboxCache() {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(KEY_V2);
  } catch {}
  // Clean up legacy v1 state as well.
  try {
    window.sessionStorage.removeItem(KEY_V1);
  } catch {}
}
