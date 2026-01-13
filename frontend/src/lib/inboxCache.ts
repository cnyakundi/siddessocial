"use client";

import type { InboxThreadView } from "@/src/lib/inboxProvider";

type CacheEntry<T> = {
  ts: number;
  value: T;
};

const TTL_MS = 30_000;
const KEY = "__sd_inbox_cache_v1__";

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
  } catch {}
}

export function makeThreadCacheKey(args: {
  id: string;
  viewer?: string;
  limit?: number;
  cursor?: string;
}) {
  const v = args.viewer || "anon";
  const limit = args.limit ?? 0;
  const cursor = args.cursor ?? "";
  return `thread:${args.id}|viewer:${v}|limit:${limit}|cursor:${cursor}`;
}

export function getCachedThread(key: string): InboxThreadView | null {
  const state = loadState();
  const entry = state[key];
  if (!entry) return null;
  if (now() - entry.ts > TTL_MS) return null;
  return entry.value as InboxThreadView;
}

export function setCachedThread(key: string, value: InboxThreadView) {
  // Safety: don't cache restricted/empty threads.
  if (!value || !value.thread) return;

  const state = loadState();
  state[key] = { ts: now(), value };
  saveState(state);
}

export function clearInboxCache() {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
}
