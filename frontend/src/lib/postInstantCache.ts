"use client";

import type { SideId } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";

export type CachedPostFound = { post: FeedPost; side: SideId };

type CacheEntry = { ts: number; found: CachedPostFound };
type CacheState = Record<string, CacheEntry>;

// Short TTL: "instant feel" (tap -> thread opens immediately), not a long offline archive.
const TTL_MS = 180_000; // 3 minutes
const KEY = "__sd_post_instant_cache_v1__";
const MAX_KEYS = 40;

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

export function makePostCacheKey(args: { epoch: string; viewerId: string; postId: string }) {
  const pid = String(args.postId || "").trim();
  // Epoch is critical. It rotates when auth state changes (prevents cross-user bleed).
  return `post:v1|epoch:${args.epoch}|viewer:${args.viewerId}|id:${pid}`;
}

function sanitizeFound(found: CachedPostFound): CachedPostFound {
  const p: any = (found as any)?.post;
  if (!p || typeof p !== "object") return found;

  // Shallow clone + clamp a couple arrays so we never store huge payloads.
  const out: any = { ...p };
  if (Array.isArray(out.attachments)) {
    out.attachments = out.attachments
      .slice(0, 6)
      .map((a: any) => (a && typeof a === "object" ? { ...a } : a));
  }
  if (Array.isArray(out.tags)) out.tags = out.tags.slice(0, 8);

  if (typeof out.content === "string" && out.content.length > 12000) out.content = out.content.slice(0, 12000);
  if (typeof out.displayContent === "string" && out.displayContent.length > 12000) out.displayContent = out.displayContent.slice(0, 12000);

  return { ...found, post: out as FeedPost };
}

export function getCachedPost(key: string): CachedPostFound | null {
  if (!key) return null;
  const state = loadState();
  const entry = state[key];
  if (!entry) return null;
  if (now() - entry.ts > TTL_MS) return null;
  return entry.found;
}

export function setCachedPost(key: string, found: CachedPostFound) {
  if (!key) return;
  if (!found || !found.post || !found.side) return;

  const safe = sanitizeFound(found);

  const state = loadState();
  state[key] = { ts: now(), found: safe };

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

export function clearPostInstantCache() {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
