"use client";

/**
 * Public Granular Siding (Topics)
 *
 * This is intentionally a client-side, localStorage-backed preference store.
 * It lets a viewer "Side" (side) a person in Public, then mute lanes per author
 * (e.g. side Sarah but mute her Politics topic).
 *
 * Safe defaults:
 * - No prefs for an author => allow everything from that author.
 * - Siding creates a record with ALL topics enabled.
 *
 * NOTE: This is UI-only in the stub era. Server enforcement comes later.
 */

import {
  PUBLIC_CHANNELS,
  normalizePublicChannel,
  type PublicChannelId,
} from "@/src/lib/publicChannels";

export type PublicSidingRecord = {
  key: string; // author handle (recommended) or authorId
  topics: PublicChannelId[];
  createdAt: number;
  updatedAt: number;
};

export type PublicSidingState = {
  v: 0;
  byKey: Record<string, PublicSidingRecord>;
};

const STORAGE_KEY = "sd.publicSiding.v0";
export const EVT_PUBLIC_SIDING_CHANGED = "sd.publicSiding.changed";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChanged() {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new Event(EVT_PUBLIC_SIDING_CHANGED));
  } catch {
    // ignore
  }
}

function defaultChannels(): PublicChannelId[] {
  return PUBLIC_CHANNELS.map((c) => c.id);
}

function safeRecord(key: string, raw: any): PublicSidingRecord | null {
  if (!raw || typeof raw !== "object") return null;

  const chans: PublicChannelId[] = Array.isArray(raw.topics)
    ? (raw.topics as unknown[]).map(normalizePublicChannel)
    : defaultChannels();

  const unique: PublicChannelId[] = Array.from(new Set(chans));

  return {
    key,
    topics: unique,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function safeState(raw: any): PublicSidingState {
  const out: PublicSidingState = { v: 0, byKey: {} };
  if (!raw || typeof raw !== "object") return out;

  const byKey = (raw as any).byKey;
  if (!byKey || typeof byKey !== "object") return out;

  for (const [k, v] of Object.entries(byKey)) {
    const key = (k || "").toString();
    if (!key) continue;
    const rec = safeRecord(key, v);
    if (rec) out.byKey[key] = rec;
  }

  return out;
}

export function loadPublicSiding(): PublicSidingState {
  if (!hasWindow()) return { v: 0, byKey: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 0, byKey: {} };
    return safeState(JSON.parse(raw));
  } catch {
    return { v: 0, byKey: {} };
  }
}

export function savePublicSiding(state: PublicSidingState) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  emitChanged();
}

export function isPublicSiding(key: string): boolean {
  const k = (key || "").toString();
  if (!k) return false;
  const st = loadPublicSiding();
  return Boolean(st.byKey[k]);
}

/**
 * Toggle side/unside. Returns the new siding state.
 */
export function togglePublicSiding(key: string): boolean {
  const k = (key || "").toString();
  if (!k) return false;

  const st = loadPublicSiding();

  if (st.byKey[k]) {
    delete st.byKey[k];
    savePublicSiding(st);
    return false;
  }

  st.byKey[k] = {
    key: k,
    topics: defaultChannels(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  savePublicSiding(st);
  return true;
}

export function getPublicSidingChannels(key: string): PublicChannelId[] {
  const k = (key || "").toString();
  if (!k) return defaultChannels();

  const st = loadPublicSiding();
  const rec = st.byKey[k];
  if (!rec) return defaultChannels();

  // Preserve explicit empty list (mute all lanes)
  const normalized = Array.from(new Set((rec.topics || []).map(normalizePublicChannel)));
  return normalized;
}

export function setPublicSidingChannels(key: string, topics: PublicChannelId[]) {
  const k = (key || "").toString();
  if (!k) return;

  const st = loadPublicSiding();
  const normalized = Array.from(new Set((topics || []).map(normalizePublicChannel)));

  const existing = st.byKey[k];
  if (existing) {
    st.byKey[k] = { ...existing, topics: normalized, updatedAt: Date.now() };
  } else {
    st.byKey[k] = { key: k, topics: normalized, createdAt: Date.now(), updatedAt: Date.now() };
  }

  savePublicSiding(st);
}

/**
 * If a viewer has no prefs for an author, we allow everything.
 */
export function publicSidingAllows(authorKey: string, topic: PublicChannelId): boolean {
  const k = (authorKey || "").toString();
  if (!k) return true;

  const st = loadPublicSiding();
  const rec = st.byKey[k];
  if (!rec) return true;

  const ch = normalizePublicChannel(topic);
  const allowed = Array.isArray(rec.topics) ? rec.topics.map(normalizePublicChannel) : [];
  return allowed.includes(ch);
}
